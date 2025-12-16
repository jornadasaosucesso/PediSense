// =========================================================================================
//  MAIN.JS - GESTÃO DE FLUXO E LÓGICA DE CARREGAMENTO (CORRIGIDO)
// =========================================================================================

// === Variáveis Globais ===
const STATIC_CODE = "Marc1234";
let doctorName = '';
let gatilhoCSV = [];

const global = {
    pacienteAtual: { id: null, nome_completo: null }, 
};

// Variáveis de contagem removidas, pois a sincronização agora é feita via Promise.all

let proximoTipoVisita = null; 

const loginMatrix = document.getElementById('login-matrix');
const videoContainer = document.getElementById('video-container');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const saudacaoContainer = document.getElementById('saudacao-container');
const micStatus = document.getElementById('mic-status');

let recognition; 
let micTimer;   
let tentativaTimer; 
let aguardandoTecla = false;

function show(el) { if (el) el.classList.add('active'); }
function hide(el) { if (el) el.classList.remove('active'); }

function desligarMicrofoneTotal() {
    if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
        
        recognition = undefined; 
    }
    clearTimeout(micTimer);
    clearTimeout(tentativaTimer);
    aguardandoTecla = false; 
    // Garante que micStatus existe antes de manipular o DOM
    if (micStatus) micStatus.innerHTML += "<br>🎤 Microfone encerrado definitivamente";
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

// ==================== FUNÇÕES DE DECISÃO DE FLUXO ====================
function chamarFluxoDitadoCalculado(tipoVisita) {
    if (typeof exibirInstrucoesDitado === "function") {
        renderizarMenu(); 
        exibirInstrucoesDitado(tipoVisita); 
    } else {
        console.error("⚠️ Função exibirInstrucoesDitado() não encontrada.");
    }
}
window.chamarFluxoDitadoCalculado = chamarFluxoDitadoCalculado;

function iniciarFluxoDitadoAutomatico(idPaciente) {
    console.log("[FLUXO AUTOMÁTICO] Iniciando decisão de tipo de visita...");
    
    // A checagem de segurança permanece.
    if (!window.dadosPacienteGlobal || !window.dadosPacienteGlobal.evolucao_clinica) {
        console.error("ERRO CRÍTICO: Carga incompleta ou 'evolucao_clinica' ausente.");
        return; 
    }

    const evolucaoHistorico = window.dadosPacienteGlobal.evolucao_clinica;
    
    let tipoVisitaCalculado;
    
    if (!evolucaoHistorico || evolucaoHistorico.length === 0 || !evolucaoHistorico.find(e => e.DATA)) {
        tipoVisitaCalculado = 'Primeira Visita';
        console.log(`[DECISÃO] Sem histórico de evolução: ${tipoVisitaCalculado}.`);
    } else {
        
        const evolucoesValidas = evolucaoHistorico.filter(e => e.DATA);
        
        const ultimaEvolucao = evolucoesValidas.sort((a, b) => new Date(b.DATA) - new Date(a.DATA))[0];
        const dataUltimaVisita = ultimaEvolucao ? new Date(ultimaEvolucao.DATA) : null;
        
        if (dataUltimaVisita) {
            const hoje = new Date();
            const diferencaDias = Math.floor((hoje - dataUltimaVisita) / (1000 * 60 * 60 * 24));
            
            if (diferencaDias <= 90) { 
                tipoVisitaCalculado = 'Retorno';
            } else { 
                tipoVisitaCalculado = 'Semestral/Anual'; 
            }
            console.log(`[DECISÃO] Última visita registrada: ${dataUltimaVisita.toLocaleDateString()}. Diferença: ${diferencaDias} dias. Tipo: ${tipoVisitaCalculado}.`);
        } else {
            tipoVisitaCalculado = 'Primeira Visita'; 
        }
    }
    
    proximoTipoVisita = tipoVisitaCalculado; 
    
    if (typeof exibirAlertasCondicionais === "function") {
        exibirAlertasCondicionais(idPaciente); 
    }
}
// FUNÇÃO DE CONTADOR REMOVIDA
// window.verificarCarregamentoCompleto = verificarCarregamentoCompleto; // Removida!

function carregarGatilho() {
    Papa.parse("/assets/dados/gatilho.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            gatilhoCSV = results.data
                .map(l => ({
                    gatilho: normalizarTexto(l.gatilho),
                    ID: l.ID
                }))
                .filter(l => l.gatilho); 

            console.log("📂 Gatilho carregado:", gatilhoCSV.length, "linhas.");
        }
    });
}

function falarSaudacao() {
    const hora = new Date().getHours();
    const saudacao = hora < 12
        ? `Bom dia Dr. ${doctorName}, estamos Ativo.`
        : `Boa tarde Dr. ${doctorName}, estamos Ativo.`;

    const pergunta = "Nome do paciente.";

    show(saudacaoContainer);

    const fala = new SpeechSynthesisUtterance(saudacao);
    speechSynthesis.speak(fala);

    fala.onend = () => {
        const perguntaFalada = new SpeechSynthesisUtterance(pergunta);
        speechSynthesis.speak(perguntaFalada);

        perguntaFalada.onend = () => {
            show(mainApp);
            ligarMicrofone();
        };
    };
}

// ==================== 1. LOGIN ====================
loginForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const nomeInput = document.getElementById('medico-nome').value.trim();
    const codigoInput = document.getElementById('medico-codigo').value.trim();

    if (codigoInput === STATIC_CODE && nomeInput) {
        doctorName = nomeInput;
        hide(loginMatrix);
        show(videoContainer);
    } else {
        console.error("Código de acesso inválido. Tente novamente."); 
        if (typeof renderizarNotificacao === "function") {
            renderizarNotificacao("Código de acesso inválido. Tente novamente.", true);
        }
    }
});

// ==================== 2. CONTROLE DE TECLADO ====================
document.addEventListener("keydown", function() {
        
    if (videoContainer.classList.contains('active')) {
        hide(videoContainer);
        falarSaudacao();
        return;
    }
    
    const modal = document.getElementById("modal-paciente");
    
    if (typeof recognition === 'undefined' && modal && !modal.classList.contains('hidden') && !aguardandoTecla) { 
        modal.classList.add('hidden');
        modal.style.display = 'none';
        
        if (proximoTipoVisita) {
            chamarFluxoDitadoCalculado(proximoTipoVisita);
        } else if (typeof renderizarMenu === "function") {
            renderizarMenu(); 
        }
        
        proximoTipoVisita = null; 
        return; 
    }

    if (aguardandoTecla) {
        aguardandoTecla = false;
        micStatus.innerHTML = "<br>🔄 Reiniciando rotina...";
        ligarMicrofone();
        return;
    }
});

// ==================== 3. MICROFONE ====================
function ligarMicrofone() {
    if (recognition) {
        console.warn("Microfone já está ativo. Ignorando ligarMicrofone().");
        return;
    }
    recognition = new webkitSpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;

    recognition.start();
    micStatus.innerHTML = "🎤 MICROFONE LIGADO";

    clearTimeout(micTimer);
    micTimer = setTimeout(() => desligarMicrofone(), 30000);

    iniciarTimerTentativa(); 

    recognition.onresult = function(event) {
        limparTimerTentativa();

        const nomePaciente = event.results[0][0].transcript.trim();
        const nomeNormalizado = normalizarTexto(nomePaciente);

        console.log("🧠 Nome capturado:", nomePaciente);
        micStatus.innerHTML += `<br>🧠 Nome capturado: ${nomePaciente}`;

        buscarIdPaciente(nomeNormalizado);
    };

    recognition.onerror = function(e) {
        if (typeof recognition === 'undefined') return; 

        console.error("⚠️ Erro no reconhecimento de voz:", e.error);
        micStatus.innerHTML += `<br>⚠️ Erro no microfone: ${e.error}`;

        reiniciarTentativa(); 
    };

    recognition.onend = function() {
        if (typeof recognition === 'undefined') {
            return; 
        }
        
        micStatus.innerHTML += "<br>🎤 Microfone desligado (Fim Inesperado)";
        reiniciarTentativa(); 
    };
}

function iniciarTimerTentativa() {
    tentativaTimer = setTimeout(() => {
        micStatus.innerHTML += "<br>⏱️ 10s sem resultado, falha...";
        reiniciarTentativa();
    }, 10000);
}

function limparTimerTentativa() {
    if (tentativaTimer) clearTimeout(tentativaTimer);
}

function reiniciarTentativa() {
    limparTimerTentativa();
    
    if (typeof recognition === 'undefined') return; 

    if (recognition) recognition.stop();
    recognition = undefined;
    
    aguardandoTecla = true;
    
    micStatus.innerHTML = `
        <div style="color:red; font-size:16px; font-weight:bold; margin-top:12px; text-align:center;">
        ⚠️ Nome não reconhecido/Timeout.<br>
        Por favor, fale novamente o nome do paciente.<br><br>
        <span style="color:#000; background:#ffeb3b; padding:6px 12px; border-radius:6px;">
          ➡️ Aperte qualquer tecla para tentar de novo
        </span>
        </div>
    `;
}

function desligarMicrofone() {
    if (recognition) recognition.stop();
    micStatus.innerHTML = "🎤 MICROFONE DESLIGADO";
}

function iniciarFluxoDitado(tipoVisita) {
    desligarMicrofoneTotal(); 

    const idPaciente = global.pacienteAtual.id; 
    if (!idPaciente) {
        console.error("⚠️ ID do paciente não definido no ditado de evolução. Voltando ao menu.");
        if (typeof renderizarMenu === "function") renderizarMenu();
        return; 
    }

    recognition = new webkitSpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;

    const micStatusRelatorio = document.getElementById('mic-status-relatorio');
    if (micStatusRelatorio) {
        micStatusRelatorio.innerHTML = "🎤 ESCUTANDO... Fale seu relatório.";
    }
    micStatus.innerHTML = "🎤 MICROFONE LIGADO (Relatório)";

    recognition.start();

    clearTimeout(micTimer);
    micTimer = setTimeout(() => {
        if (recognition) recognition.stop();
        console.error("Tempo esgotado (60s). Por favor, tente novamente.");
        if (typeof renderizarNotificacao === "function") {
            renderizarNotificacao("Tempo esgotado (60s). Por favor, tente novamente.", true);
        }
        if (typeof renderizarMenu === "function") renderizarMenu();
    }, 60000); 

    recognition.onresult = function(event) {
        const textoDitado = event.results[0][0].transcript;
        console.log(`[DITADO] Texto capturado: ${textoDitado}`);
        
        desligarMicrofoneTotal(); 
        
        if (typeof salvarRelatorioGemini === "function") {
            salvarRelatorioGemini(idPaciente, tipoVisita, textoDitado);
        } else {
            console.error("⚠️ Função de salvamento ausente.");
            if (typeof renderizarNotificacao === "function") {
                renderizarNotificacao("Erro fatal: função de salvamento ausente.", true);
            }
            if (typeof renderizarMenu === "function") renderizarMenu();
        }
    };

    recognition.onerror = function(e) {
        console.error("⚠️ Erro no reconhecimento de voz durante o ditado:", e.error);
        if (typeof renderizarNotificacao === "function") {
            renderizarNotificacao(`Erro na captura: ${e.error}. Tente novamente.`, true);
        }
        desligarMicrofoneTotal();
        if (typeof renderizarMenu === "function") renderizarMenu();
    };

    recognition.onend = function() {
    };
}
window.iniciarFluxoDitado = iniciarFluxoDitado;

// ==================== 4. BUSCA E CRIAÇÃO NO GATILHO (REVISADO) ====================

async function lidarComBuscaECriacao(nomeNormalizado) {
    micStatus.innerHTML += `<br>🔍 Buscando/Criando paciente...`;
    
    try {
        const response = await fetch('/api/paciente/buscar-ou-criar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome_capturado: nomeNormalizado }),
        });

        if (!response.ok) {
            throw new Error(`Erro de rede ou servidor ao buscar/criar paciente: ${response.status}`);
        }

        const resultado = await response.json();

        const idPaciente = resultado.id;
        const nomeCompleto = resultado.nome_completo;
        const status = resultado.status;
        
        global.pacienteAtual.id = idPaciente;
        global.pacienteAtual.nome_completo = nomeCompleto;

        micStatus.innerHTML += `<br>✅ ID: ${idPaciente}. Status: ${status}. Carregando dados...`;
        
        if (typeof abrirModalPaciente === "function" && typeof processarDadosUI === "function") {
            
            if (status === 'CRIADO') {
                const dadosBase = [{
                    ID: String(idPaciente),
                    nome: nomeCompleto,
                    data_nascimento: '',
                    filiacao_pai: '',
                    filiacao_mae: '',
                    plano_saude: '',
                    dados_nascimento: ''
                }];
                // Envia dados_paciente imediatamente para preencher o cabeçalho no UI.JS
                processarDadosUI("dados_paciente.csv", dadosBase); 
                
                if (typeof renderizarNotificacao === "function") {
                    renderizarNotificacao(`Paciente **${nomeCompleto}** cadastrado como NOVO. Iniciando protocolo de Primeira Visita.`);
                }
            }

            // AWAIT IMPLÍCITO AQUI: A função carregarArquivosPaciente agora espera a conclusão
            await carregarArquivosPaciente(idPaciente); 

            abrirModalPaciente(idPaciente);
            
        } else {
            console.error("⚠️ Funções críticas (abrirModalPaciente/processarDadosUI) não encontradas! Verifique o ui.js.");
        }

    } catch (error) {
        console.error("Erro no fluxo de busca/criação:", error);
        
        aguardandoTecla = true; 
        micStatus.innerHTML = `
            <div style="color:red; font-size:16px; font-weight:bold; margin-top:12px; text-align:center;">
            ⚠️ Erro no servidor: ${error.message || "Falha de comunicação"}.<br>
            ➡️ Aperte qualquer tecla para tentar de novo.
            </div>
        `;
    }
}


function buscarIdPaciente(nomePaciente) {
    const nomeNormalizado = normalizarTexto(nomePaciente);
    
    desligarMicrofoneTotal(); 

    // Esta função foi alterada para lidar com a busca/criação
    lidarComBuscaECriacao(nomeNormalizado);

    return true; 
}

function calcularDistancia(a, b) {
    const dp = Array(b.length + 1).fill().map(() => []);
    for (let i = 0; i <= b.length; i++) dp[i][0] = i;
    for (let j = 0; j <= a.length; j++) dp[0][j] = j;

    for (let i = 1; i <= b.length; i++)
        for (let j = 1; j <= a.length; j++)
            dp[i][j] = b[i - 1] === a[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);

    return dp[b.length][a.length];
}

function resetarAplicacao() {
    doctorName = '';
    
    global.pacienteAtual = { id: null, nome_completo: null };

    if (typeof resetarDadosUI === "function") {
        resetarDadosUI();
    }

    desligarMicrofoneTotal(); 

    hide(mainApp);
    hide(videoContainer);
    
    const modalPaciente = document.getElementById("modal-paciente");
    if (modalPaciente) modalPaciente.classList.add('hidden');
    
    const infoModal = document.getElementById("info-modal");
    if (infoModal) infoModal.classList.add('hidden');

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.reset(); 
    
    if (micStatus) micStatus.innerHTML = ""; 
    
    show(loginMatrix); 
    console.log("Sistema resetado. Voltando para o Login.");
}
window.resetarAplicacao = resetarAplicacao;


// ==================== 5. CARGA DE ARQUIVOS (CORRIGIDO) ====================

// Função auxiliar que encapsula Papa.parse em uma Promessa
function carregarArquivo(arquivo) {
    return new Promise((resolve, reject) => {
        Papa.parse(`/assets/dados/${arquivo}`, {
            download: true,
            header: true,
            skipEmptyLines: true,
            encoding: "utf8",
            complete: function(results) {
                console.log(`📄 Arquivo ${arquivo} carregado.`);
                resolve({ arquivo, dados: results.data });
            },
            error: function(error) {
                console.error(`❌ Erro ao carregar ${arquivo}:`, error);
                reject(error);
            }
        });
    });
}

/**
 * 🛠️ FLUXO DE CARGA CORRIGIDO E SINCRONIZADO
 * Garante que todos os 9 arquivos sejam lidos e processados no UI.JS
 * antes de iniciar a análise.
 */
async function carregarArquivosPaciente(idPaciente) {
    const arquivos = [
        "dados_paciente.csv", 
        "alergia.csv",
        "comorbidade.csv",
        "exame.csv", 
        "imunizacao.csv",
        "evolucao_clinica.csv",
        "internacao_hospitalar.csv",
        "medicamento.csv",
        "antropometria.csv"
    ];
    
    // 1. Cria um array de Promessas para carregar todos os arquivos
    const promises = arquivos.map(carregarArquivo);

    try {
        // 2. AGUARDA que TODOS os arquivos terminem de carregar e serem resolvidos
        const resultados = await Promise.all(promises);
        
        console.log(`[CARGA] Arquivos processados: ${resultados.length} de ${arquivos.length} para ID: ${idPaciente}`);
        
        // 3. Processa e salva os dados no UI.JS (agora garantido que todos os arquivos chegaram)
        resultados.forEach(({ arquivo, dados }) => {
            const idBusca = String(idPaciente).replace(/[\uFEFF\u200B\s]+/g, '').trim();
            
            const dadosPaciente = dados.filter(l => {
                if (!l.ID) return false;
                const idCSV = String(l.ID).replace(/[\uFEFF\u200B\s]+/g, '').trim();
                return idCSV === idBusca;
            });
            
            if (typeof processarDadosUI === "function") {
                // Chama a função do UI.JS que armazena os dados em dadosPacienteGlobal
                processarDadosUI(arquivo, dadosPaciente); 
            }
        });
        
        console.log("✅ CARGA COMPLETA. EXECUTANDO ANÁLISE MASTER.");
        
        // 4. Inicia a análise APÓS o processamento de TODOS os dados
        iniciarFluxoDitadoAutomatico(idPaciente); 

    } catch (error) {
        console.error("❌ ERRO CRÍTICO NA CARGA DE DADOS:", error);
    }
}

carregarGatilho();