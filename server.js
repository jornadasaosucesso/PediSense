import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises"; // Para leitura assíncrona
import fsSync from "fs"; // Para escrita síncrona (append)

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURAÇÃO DE CAMINHOS ---
const publicPath = path.join(__dirname, "frontend"); 
const assetsPath = path.join(publicPath, "assets", "dados");

// Caminhos dos arquivos CSV e JSON
const GATILHO_PATH = path.join(assetsPath, 'gatilho.csv');
const DADOS_PACIENTE_PATH = path.join(assetsPath, 'dados_paciente.csv');
const ID_COUNTER_PATH = path.join(assetsPath, 'id_counter.json');

// Arquivos de dados secundários (Todos devem ter um registro base com o ID)
const ARQUIVOS_SECUNDARIOS = [
    'evolucao_clinica.csv', 'medicamento.csv', 'alergia.csv', 'comorbidade.csv', 
    'exame.csv', 'imunizacao.csv', 'internacao_hospitalar.csv', 'antropometria.csv'
].map(file => path.join(assetsPath, file));


// 1. Habilitar JSON Body Parser (Para ler req.body)
app.use(express.json());

// === FUNÇÕES AUXILIARES DE CSV ===

// Função genérica para ler CSV (retorna array de objetos)
async function readCSV(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const lines = data.trim().split('\n');
        
        // Se o arquivo estiver vazio (apenas cabeçalho), retorna um array vazio
        if (lines.length <= 1) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        const records = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length !== headers.length) continue; 

            const record = {};
            for (let j = 0; j < headers.length; j++) {
                // Remove aspas e espaços
                record[headers[j]] = values[j].replace(/"/g, '').trim(); 
            }
            records.push(record);
        }
        return records;
    } catch (error) {
        // Se o arquivo não existir ou houver erro, retorna array vazio
        return []; 
    }
}

function normalizarTexto(txt) {
    if (!txt) return "";
    return txt
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Retorna o próximo ID seguro. Tenta ler de id_counter.json,
 * se falhar, faz um fallback lento lendo dados_paciente.csv.
 */
async function getNextSafeId() {
    let ultimoId = 0;
    
    try {
        // Tenta ler do arquivo JSON (Método Rápido e Seguro)
        const contadorData = await fs.readFile(ID_COUNTER_PATH, 'utf-8');
        const contador = JSON.parse(contadorData);
        if (contador && typeof contador.ultimo_id_utilizado === 'number') {
            ultimoId = contador.ultimo_id_utilizado;
        } else {
             console.warn("[ID WARN] id_counter.json corrompido ou mal formatado. Usando fallback...");
        }

    } catch (error) {
        // Fallback Lento (em caso de arquivo ausente ou erro de leitura/parsing)
        console.warn(`[ID FALLBACK] Erro ao ler/parsear ${ID_COUNTER_PATH}. Lendo dados_paciente.csv para obter o último ID.`);
        const dadosPacientes = await readCSV(DADOS_PACIENTE_PATH);
        // Encontra o maior ID existente em dados_paciente.csv
        ultimoId = dadosPacientes.reduce((max, p) => Math.max(max, parseInt(p.ID) || 0), 0); 
    }
    
    return ultimoId + 1;
}


// =========================================================================
// ROTA DE API: BUSCAR OU CRIAR PACIENTE (POST)
// =========================================================================
app.post('/api/paciente/buscar-ou-criar', async (req, res) => {
    if (!req.body || !req.body.nome_capturado) {
        return res.status(400).json({ status: "ERRO", message: "Nome do paciente ausente." });
    }
    
    const nomeCapturado = req.body.nome_capturado;
    const nomeNormalizado = normalizarTexto(nomeCapturado);

    try {
        // A. BUSCA NO GATILHO
        const gatilhoCSV = await readCSV(GATILHO_PATH);
        
        // Verifica se o nome normalizado está contido em algum gatilho
        let linhaEncontrada = gatilhoCSV.find(l => 
            l.gatilho && normalizarTexto(l.gatilho).includes(nomeNormalizado)
        );
        
        // B. ENCONTRADO: Retorna o registro existente
        if (linhaEncontrada) {
            console.log(`[API] Paciente ID ${linhaEncontrada.ID} encontrado.`);
            return res.json({ 
                id: linhaEncontrada.ID, 
                nome_completo: nomeCapturado,
                status: "ENCONTRADO" 
            });
        }
        
        // C. NÃO ENCONTRADO: CRIA NOVO REGISTRO
        
        // C1. Calcular Novo ID
        const novoId = await getNextSafeId();
        const novoIdStr = String(novoId);
        
        // C2. Geração de Variações do Gatilho 
        const partesNome = nomeNormalizado.split(' ').filter(p => p.length > 0);
        let linhasGatilho = [];

        // Regra: Nome Completo + (Nome + 1º Sobrenome) + (Nome + 2º Sobrenome)
        linhasGatilho.push(nomeNormalizado);

        // Nome + 1º Sobrenome (ex: Luana Maria Viana -> Luana Maria)
        if (partesNome.length >= 2) {
            linhasGatilho.push(`${partesNome[0]} ${partesNome[1]}`);
        }
        
        // Nome + 2º Sobrenome (ex: Luana Maria Viana -> Luana Viana)
        if (partesNome.length >= 3) {
            linhasGatilho.push(`${partesNome[0]} ${partesNome[2]}`);
        }
        
        // Remove duplicatas e garante que haja pelo menos o nome completo
        linhasGatilho = [...new Set(linhasGatilho)];
        
        // C3. GERAÇÃO DAS STRINGS CSV 
        
        // Linhas Gatilho CSV (ID,gatilho) - Adiciona o ID na frente
        const linhasGatilhoCSV = linhasGatilho
            .map(variacao => `\n${novoIdStr},${variacao}`)
            .join('');

        // Linha para dados_paciente.csv: ID,"nome",data,filiacao_pai,filiacao_mae,plano,dados_nascimento
        const novaLinhaPaciente = `\n${novoIdStr},"${nomeCapturado}",,,,,,`; 
        
        // Linhas vazias para as demais tabelas (ID e campos vazios: ID + 4 vírgulas)
        const linhasVazias = `\n${novoIdStr},,,,`; 

        // C4. Escrever nos Arquivos CSV (APPEND SÍNCRONO)
        fsSync.appendFileSync(GATILHO_PATH, linhasGatilhoCSV, 'utf8');
        fsSync.appendFileSync(DADOS_PACIENTE_PATH, novaLinhaPaciente, 'utf8');
        
        // Arquivos Secundários (Garantia de Integridade de Dados)
        for (const filePath of ARQUIVOS_SECUNDARIOS) {
            fsSync.appendFileSync(filePath, linhasVazias, 'utf8');
        }

        // C5. ATUALIZAR O CONTADOR (SOMENTE SE HOUVE SUCESSO NA ESCRITA)
        try {
             const contador = { ultimo_id_utilizado: novoId };
             fsSync.writeFileSync(ID_COUNTER_PATH, JSON.stringify(contador, null, 2));
        } catch (updateError) {
            console.error("[ID COUNTER ERROR] Falha ao atualizar id_counter.json. O ID será recalculado na próxima rodada.", updateError.message);
        }

        console.log(`[API] Paciente ID ${novoId} CRIADO e sincronizado em 9 arquivos.`);

        // D. RETORNA O REGISTRO CRIADO
        return res.json({ 
            id: novoIdStr, 
            nome_completo: nomeCapturado, 
            status: "CRIADO" 
        });

    } catch (error) {
        console.error("[API ERROR] Falha ao processar busca/criação:", error);
        return res.status(500).json({ status: "ERRO", message: `Falha interna do servidor: ${error.message}` });
    }
});


// ---------------------------------------------------------------------------------

// Servir arquivos estáticos (css, js, assets, vídeos, etc.)
app.use(express.static(publicPath));

// Fallback para SPA (DEVE VIR POR ÚLTIMO)
app.use((req, res, next) => {
    // Se a requisição é para uma rota que começa com '/api', e não foi encontrada, retorna 404/JSON.
    if (req.url.startsWith('/api')) {
         return res.status(404).json({ message: "Endpoint de API não encontrado." });
    }
    
    // Para todas as outras requisições (rotas de Front-end), retorna o index.html
    res.sendFile(path.join(__dirname, "index.html"));
});

// Porta
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`🚀 PediSense rodando em http://localhost:${PORT}`);
    console.log(`📚 A rota de criação de paciente é: POST /api/paciente/buscar-ou-criar`);
});