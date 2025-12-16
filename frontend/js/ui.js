// ======================================================
//  UI.JS — GERENCIAMENTO DE INTERFACE E ANÁLISE CONDICIONAL
// ======================================================
// === Armazenamento Global de Dados ===
const dadosPacienteGlobal = {
    ID: null,
    dados_paciente: [],
    alergia: [],
    comorbidade: [],
    exame: [],
    imunizacao: [],
    evolucao_clinica: [],
    internacao_hospitalar: [],
    medicamento: [],
    antropometria: []
};

let alertasGerados = []; 
let nomePacienteAtual = 'Paciente Não Identificado';

const mapeamentoComandos = {
    'dados cadastrais': { arquivo: 'dados_paciente', titulo: 'Dados Cadastrais' },
    'antropometria': { arquivo: 'antropometria', titulo: 'Antropometria' },
    'exames': { arquivo: 'exame', titulo: 'Exames e Resultados' },
    'vacinas': { arquivo: 'imunizacao', titulo: 'Imunização (Vacinas)' },
    'medicamentos': { arquivo: 'medicamento', titulo: 'Medicamentos Ativos' },
    'alergias': { arquivo: 'alergia', titulo: 'Alergias' },
    'comorbidades': { arquivo: 'comorbidade', titulo: 'Comorbidades' },
    'evolução': { arquivo: 'evolucao_clinica', titulo: 'Evolução Clínica' },
    'internação': { arquivo: 'internacao_hospitalar', titulo: 'Histórico de Internação' },
    'menu': { acao: 'menu', titulo: 'Menu Principal' },
    'Diagnostico (Ditado)': { acao: 'Diagnostico',titulo: 'Diagnostico Medico', icon: '🎙️', cor: '#6f42c1' }, 
    'Novo Paciente': {acao: 'reset', icon: '🔄', cor: '#343a40', titulo: 'Novo Paciente'},
    'voltar': { acao: 'menu', titulo: 'Menu Principal' },
};

// --- GESTOR DE COMANDOS DE VOZ (NOVO) ---
function gestorComandos(comando) {
    const comandoNormalizado = comando.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos

    for (const chave in mapeamentoComandos) {
        if (comandoNormalizado.includes(chave)) {
            const acao = mapeamentoComandos[chave];
            
            if (acao.acao === 'menu') {
                renderizarMenu();
                return { tipo: 'NAVEGACAO' };
            }
            if (acao.acao === 'reset') {
                window.resetarAplicacao();
                return { tipo: 'NAVEGACAO' }; // Reset conta como navegação de fluxo
            }
            
            renderizarDadosDetalhe(acao.arquivo, acao.titulo);
            return { tipo: 'NAVEGACAO' };
        }
    }

    const comandosIA = [
        'resumo', 'analisar', 'comparar', 'qual é o diagnóstico', 
        'o que aconteceu', 'informe sobre'
    ];
    
    if (comandosIA.some(c => comandoNormalizado.includes(c))) {
        // Envia para o main.js fazer a chamada à API
        return { tipo: 'IA' }; 
    }
    
    exibirMensagemMicrofone(`Comando "${comando}" não reconhecido. Tente "mostrar exames" ou "resumo do caso".`);
    return { tipo: 'DESCONHECIDO' };
}
window.gestorComandos = gestorComandos;

// --- FUNÇÃO PARA EXIBIR RESULTADOS DA IA ---
function exibirResultadoIA(pergunta, resposta) {
    const dadosContainer = document.getElementById('dados-container');
    const menuJanela = document.getElementById('menu-janela');

    menuJanela.classList.add('hidden');
    dadosContainer.classList.remove('hidden');
    
    dadosContainer.innerHTML = `
        <div style="padding: 20px; background: #fff; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="color: #6f42c1; margin: 0;">🧠 Análise PediSense (IA)</h2>
                <button onclick="renderizarMenu()" style="background-color: #6c757d; color: white; padding: 10px 15px; border: none; border-radius: 6px; cursor: pointer;">
                    &larr; Voltar ao Menu
                </button>
            </div>
            
            <p style="font-style: italic; color: #007bff; font-weight: bold; border-left: 3px solid #007bff; padding-left: 10px;">
                **COMANDO DE VOZ:** ${pergunta}
            </p>
            
            <div style="background: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px; white-space: pre-wrap;">
                <h3 style="margin-top: 0; color: #343a40;">RESPOSTA DO ASSISTENTE:</h3>
                <p>${resposta}</p>
            </div>
        </div>
    `;
    
    gerenciarMicrofone(true);
}
window.exibirResultadoIA = exibirResultadoIA;

// --- FUNÇÃO PARA GERENCIAR O MICROFONE (SIMULAÇÃO) ---
function gerenciarMicrofone(ativo, statusMensagem = 'Pronto para receber comandos...') {
    const micStatus = document.getElementById('mic-status');
    const micIcon = document.getElementById('mic-icon'); 
    
    if (!micStatus || !micIcon) {
        return; 
    }
    
    if (ativo) {
        micStatus.style.backgroundColor = '#d4edda'; // Verde claro (Ativo)
        micStatus.style.color = '#155724';
        micStatus.style.border = '1px solid #c3e6cb';
        micIcon.innerHTML = '🎤 ATIVO';
        micStatus.title = "Diga um comando (ex: 'mostrar exames' ou 'resumo do caso').";
    } else {
        micStatus.style.backgroundColor = '#f8d7da'; // Vermelho claro (Inativo/Processando)
        micStatus.style.color = '#721c24';
        micStatus.style.border = '1px solid #f5c6cb';
        micIcon.innerHTML = `🚫 ${statusMensagem}`;
        micStatus.title = "Processando comando ou aguardando. Microfone inativo.";
    }
}
window.gerenciarMicrofone = gerenciarMicrofone;

function exibirMensagemMicrofone(mensagem) {
    const micStatus = document.getElementById('mic-status');
    const micIcon = document.getElementById('mic-icon');
    
    micStatus.style.backgroundColor = '#ffeeba'; // Amarelo
    micStatus.style.color = '#856404';
    micStatus.style.border = '1px solid #ffeeba';
    micIcon.innerHTML = `⚠️ ${mensagem}`;
    
    setTimeout(() => gerenciarMicrofone(true), 3000);
}

function processarDadosUI(nomeArquivo, dados) {
    const nomeCurto = nomeArquivo.replace('.csv', '');
    if (dadosPacienteGlobal.hasOwnProperty(nomeCurto)) {
        dadosPacienteGlobal[nomeCurto] = dados;
        if (nomeCurto === 'dados_paciente' && dados.length > 0) {
            dadosPacienteGlobal.ID = dados[0].ID;
            
            const primeiraLinha = dados[0];
            
            let nomeLido = primeiraLinha.nome || // 🛑 PRINCIPAL CORREÇÃO
                           primeiraLinha.NOME_COMPLETO || 
                           primeiraLinha.NOME || 
                           primeiraLinha.NOME_PACIENTE || 
                           primeiraLinha.NAME || 
                           'Paciente Não Identificado';
                           
            if (!nomeLido || nomeLido.trim() === '') {
                nomeLido = 'Paciente Não Identificado';
            }

            nomePacienteAtual = nomeLido;
            console.log(`[UI] Nome do paciente definido: ${nomePacienteAtual}`);
            
            atualizarHeaderEStatus(); // Atualiza o header assim que o nome for carregado
        }
    }
}
window.processarDadosUI = processarDadosUI;

function atualizarHeaderEStatus() {
    const mainApp = document.getElementById('main-app');
    let header = document.getElementById('app-header');

    let nomeParaExibir = nomePacienteAtual;
    if (nomeParaExibir === 'Paciente Não Identificado' && dadosPacienteGlobal.dados_paciente.length > 0) {
        const primeiraLinha = dadosPacienteGlobal.dados_paciente[0];
        nomeParaExibir = primeiraLinha.nome ||
                         primeiraLinha.NOME_COMPLETO || 
                         primeiraLinha.NOME || 
                         primeiraLinha.NOME_PACIENTE || 
                         primeiraLinha.NAME || 
                         'Paciente Não Identificado';
        nomePacienteAtual = nomeParaExibir; 
    }

    if (!header) {
        header = document.createElement('div');
        header.id = 'app-header';
        header.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; 
            background-color: #007bff; color: white; padding: 10px 24px; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 1000;
            display: flex; justify-content: space-between; align-items: center;
        `;
        mainApp.insertBefore(header, mainApp.firstChild);
        mainApp.style.paddingTop = '50px'; 
    }
    
    const alertBadge = alertasGerados.length > 0 
        ? `<span style="background: red; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; margin-left: 10px;">${alertasGerados.length} Alerta(s)</span>`
        : '';

    header.innerHTML = `
        <div style="display: flex; align-items: center;">
            <span style="font-size: 1.2em; font-weight: bold;">PACIENTE: ${nomeParaExibir} </span>
            ${alertBadge}
        </div>
        <button onclick="renderizarMenu()" style="background-color: #ffc107; color: #333; padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            MENU &larr;
        </button>
    `;
    
    const micStatus = document.getElementById('mic-status');
    if (micStatus) {
        micStatus.style.position = 'fixed'; // Posição fixa para o mic
        micStatus.style.bottom = '20px';
        micStatus.style.right = '20px';
        micStatus.style.backgroundColor = '#fff';
        micStatus.style.padding = '8px';
        micStatus.style.borderRadius = '6px';
        micStatus.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
        micStatus.style.color = '#222';
        micStatus.style.fontSize = '0.9em';
        micStatus.style.zIndex = '1001'; // Fica acima do header
    }
}

function exibirAlertasCondicionais(idPaciente) {
    alertasGerados = []; // Limpa alertas anteriores
    console.log("INICIANDO ANÁLISE MASTER para ID:", idPaciente);
    
    const dados = dadosPacienteGlobal;

    const tempMaxima = 38.5;
    const antroRecente = dados.antropometria.sort((a, b) => new Date(b.DATA) - new Date(a.DATA))[0];
    
    if (antroRecente && parseFloat(antroRecente.TEMPERATURA) > tempMaxima) {
        alertasGerados.push({
            tipo: 'CRÍTICO',
            cor: 'red',
            mensagem: `FEBRE ALTA: Temperatura de ${antroRecente.TEMPERATURA}°C registrada em ${antroRecente.DATA}. Risco de complicação!`
        });
    } else if (antroRecente && parseFloat(antroRecente.TEMPERATURA) > 37.5) {
        alertasGerados.push({
            tipo: 'ATENÇÃO',
            cor: 'orange',
            mensagem: `Temperatura elevada: ${antroRecente.TEMPERATURA}°C registrada. Monitore de perto.`
        });
    }

    // --- ANÁLISE 2: ALERGIAS GRAVES 
    const alergiasGraves = dados.alergia.filter(a => a.GRAVIDADE && a.GRAVIDADE.toUpperCase() === 'GRAVE');
    if (alergiasGraves.length > 0) {
        const nomesAlergias = alergiasGraves.map(a => a.ALERGENO).join(', ');
        alertasGerados.push({
            tipo: 'CRÍTICO',
            cor: 'red',
            mensagem: `ALERGIA(S) GRAVE(S) REGISTRADA(S): ${nomesAlergias}. Verifique sempre antes de prescrever!`
        });
    }
    
    // --- ANÁLISE 3: MEDICAMENTOS DE ALTO RISCO 
    const medicamentosRisco = ['CORTICOSTEROIDE', 'IMUNOSSUPRESSOR', 'ANTIBIÓTICO DE ÚLTIMA GERAÇÃO'];
    const medsAtuais = dados.medicamento.filter(m => 
        m.CLASSE && m.STATUS && medicamentosRisco.includes(m.CLASSE.toUpperCase()) && m.STATUS.toUpperCase() === 'ATIVO'
    );
    
    if (medsAtuais.length > 0) {
        const nomesMeds = medsAtuais.map(m => m.NOME_COMERCIAL).join(', ');
        alertasGerados.push({
            tipo: 'ATENÇÃO',
            cor: 'yellow',
            mensagem: `MEDICAÇÃO CRÍTICA ATIVA: ${nomesMeds}. Requer cautela na interação medicamentosa.`
        });
    }

    // --- ANÁLISE 4: INTERNAÇÃO RECENTE
    const internacoes = dados.internacao_hospitalar.sort((a, b) => new Date(b.DATA_SAIDA) - new Date(a.DATA_SAIDA));
    const ultimaInternacao = internacoes[0];
    const umMesAtras = new Date();
    umMesAtras.setMonth(umMesAtras.getMonth() - 1);
    
    if (ultimaInternacao && ultimaInternacao.DATA_SAIDA && new Date(ultimaInternacao.DATA_SAIDA) > umMesAtras) {
        alertasGerados.push({
            tipo: 'INFORMATIVO',
            cor: 'blue',
            mensagem: `INTERNAÇÃO RECENTE: Última saída em ${ultimaInternacao.DATA_SAIDA} por ${ultimaInternacao.DIAGNOSTICO_PRINCIPAL}. Atente-se à recuperação.`
        });
    }

    // --- ANÁLISE 5: VACINAS PENDENTES
    const vacinasPendentes = dados.imunizacao.filter(v => 
        v.STATUS && v.STATUS.toUpperCase() === 'PENDENTE'
    );

    if (vacinasPendentes.length > 0) {
        const nomesVacinas = vacinasPendentes.map(v => v.NOME_VACINA).join(', ');
        alertasGerados.push({
            tipo: 'ATENÇÃO',
            cor: 'orange',
            mensagem: `PENDÊNCIA VACINAL: ${vacinasPendentes.length} vacinas pendentes (${nomesVacinas}). Agendar ou atualizar a caderneta.`
        });
    }

    atualizarHeaderEStatus();
    
    renderizarConteudoModalPaciente(alertasGerados);
}
window.exibirAlertasCondicionais = exibirAlertasCondicionais; // Expor globalmente


function abrirModalPaciente(idPaciente) {
    const modal = document.getElementById('modal-paciente');
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
}
window.abrirModalPaciente = abrirModalPaciente; 

document.getElementById('close-paciente').onclick = function() {
    const modal = document.getElementById('modal-paciente');
    modal.style.display = 'none';
    modal.classList.add('hidden');
    
    renderizarMenu(); 
};

function renderizarConteudoModalPaciente(alertas) {
    const corpoModal = document.getElementById('modal-body-paciente');
    const nomeCompleto = nomePacienteAtual; 

    let htmlAlertas = alertas.length > 0 
        ? alertas.map(a => {
            const corDisplay = a.cor === 'orange' ? '#ff8c00' : a.cor === 'yellow' ? '#daa520' : a.cor;
            return `
            <div style="padding: 10px; margin-bottom: 8px; border-radius: 4px; border: 1px solid #ccc; background-color: ${a.cor === 'red' ? '#f8d7da' : a.cor === 'orange' ? '#ffeeba' : a.cor === 'yellow' ? '#fff3cd' : '#d1ecf1'}; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #333; border-left: 5px solid ${corDisplay};">
                <span style="font-weight: bold; color: ${corDisplay};">${a.tipo}:</span> ${a.mensagem}
            </div>
        `;
        }).join('')
        : `<p style="color: green; font-style: italic; font-weight: bold;">Nenhum alerta crítico ou de atenção encontrado na análise inicial. Prossiga para o menu.</p>`;


    corpoModal.innerHTML = `
        <h2 style="color: #007bff; margin-top: 0;">Análise Inicial do Paciente</h2>
        <h1 style="margin-bottom: 15px; border-bottom: 2px solid #ccc; padding-bottom: 10px;">${nomeCompleto}</h1>
        
        <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #dc3545; border-bottom: 1px solid #dc3545; padding-bottom: 5px;">🛑 ALERTAS CRÍTICOS (ANÁLISE PediSense)</h3>
            ${htmlAlertas}
        </div>
        
        <p style="font-size: 1.1em; text-align: center; margin-top: 30px; padding: 10px; border: 1px dashed #ccc;">
            Pressione **ESC** ou clique no **X** para fechar e acessar o menu principal do prontuário.
        </p>
    `;
}

function renderizarMenu() {
    const menuJanela = document.getElementById('menu-janela');
    const dadosContainer = document.getElementById('dados-container');
    
    dadosContainer.classList.add('hidden');
    menuJanela.classList.remove('hidden');
    
    menuJanela.innerHTML = `
        <div style="padding: 20px; background: #fff; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); margin-top: 20px;">
            <h2 style="color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 10px;">MENU PRINCIPAL DO PRONTUÁRIO</h2>
            
            <p style="font-style: italic; margin-top: 0; color: #555;">Selecione um tópico para ver os dados detalhados. Para usar a IA, diga um comando como: **"Resumo do caso"**.</p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-top: 20px;">
                ${gerarBotoesMenu()}
            </div>
            <div id="alertas-menu" style="margin-top: 30px;">
                ${renderizarAlertasNoMenu()}
            </div>
        </div>
    `;
    
    gerenciarMicrofone(true);
}
window.renderizarMenu = renderizarMenu;

function renderizarAlertasNoMenu() {
    if (alertasGerados.length === 0) {
        return `<p style="color: green; font-style: italic; font-weight: bold; text-align: center;">Nenhum alerta pendente. Prossiga com a consulta.</p>`;
    }
    
    const criticos = alertasGerados.filter(a => a.tipo === 'CRÍTICO').length;
    const atencao = alertasGerados.filter(a => a.tipo === 'ATENÇÃO').length;
    const informativo = alertasGerados.filter(a => a.tipo === 'INFORMATIVO').length;

    let resumo = '';
    if (criticos > 0) resumo += `<span style="color: red; font-weight: bold;">${criticos} CRÍTICO(S)</span> `;
    if (atencao > 0) resumo += `<span style="color: orange; font-weight: bold;">${atencao} ATENÇÃO</span> `;
    if (informativo > 0) resumo += `<span style="color: blue; font-weight: bold;">${informativo} INFORMATIVO</span>`;

    return `
        <div style="border: 2px solid #ffc107; padding: 15px; border-radius: 8px; background: #fff3cd; color: #856404; text-align: center;">
            <p style="margin: 0; font-weight: bold; font-size: 1.1em;">RESUMO DE ALERTAS:</p>
            <p style="margin: 5px 0 0 0; font-size: 1.2em;">${resumo}</p>
        </div>
    `;
}

function gerarBotoesMenu() {
    const botoes = [
        { nome: 'Dados Cadastrais', arquivo: 'dados_paciente', icon: '👤', cor: '#007bff' },
        { nome: 'Antropometria', arquivo: 'antropometria', icon: '📏', cor: '#28a745' },
        { nome: 'Exames e Resultados', arquivo: 'exame', icon: '🔬', cor: '#dc3545' },
        { nome: 'Imunização (Vacinas)', arquivo: 'imunizacao', icon: '💉', cor: '#ffc107' },
        { nome: 'Medicamentos Ativos', arquivo: 'medicamento', icon: '💊', cor: '#17a2b8' },
        { nome: 'Alergias', arquivo: 'alergia', icon: '🚨', cor: '#fd7e14' },
        { nome: 'Comorbidades', arquivo: 'comorbidade', icon: '🤕', cor: '#6f42c1' },
        { nome: 'Evolução Clínica', arquivo: 'evolucao_clinica', icon: '📝', cor: '#20c997' },
        { nome: 'Histórico de Internação', arquivo: 'internacao_hospitalar', icon: '🏥', cor: '#6c757d' },
        { nome: 'Evolução (Ditado)', acao: 'iniciarFluxoDitado', icon: '🎙️', cor: '#6f42c1' }, // NOVO BOTÃO AQUI
        { nome: 'Novo Paciente', acao: 'reset', icon: '🔄', cor: '#343a40' },
    ];

    return botoes.map(btn => {
            let acao;
            if (btn.acao === 'reset') {
                acao = 'resetarAplicacao()';
            } else if (btn.acao === 'iniciarFluxoDitado') {
                acao = 'solicitarTipoVisita()';
            } else {
                acao = `renderizarDadosDetalhe('${btn.arquivo}', '${btn.nome}')`;
            }

            return `
            <button 
                onclick="${acao}" 
                // ... (Estilos) ...
            >
                ${btn.icon} ${btn.nome}
            </button>
            `;
        }).join('');
    }

function renderizarDadosDetalhe(arquivo, titulo) {
    const menuJanela = document.getElementById('menu-janela');
    const dadosContainer = document.getElementById('dados-container');
    
    menuJanela.classList.add('hidden');
    dadosContainer.classList.remove('hidden');

    const dados = dadosPacienteGlobal[arquivo] || [];
    let htmlTabela = '';
    
    if (dados.length > 0) {
        const headers = Object.keys(dados[0]).filter(h => h !== 'ID'); 
        
        htmlTabela += `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9em;">`;
        htmlTabela += `<thead><tr style="background-color: #007bff; color: white;">`;
        headers.forEach(header => {
            htmlTabela += `<th style="padding: 10px; border: 1px solid #ccc; text-align: left;">${header.replace(/_/g, ' ')}</th>`;
        });
        htmlTabela += `</tr></thead><tbody>`;

        dados.forEach(linha => {
            htmlTabela += `<tr style="background-color: #f9f9f9; border-bottom: 1px solid #eee;">`;
            headers.forEach(header => {
                const valor = linha[header] || '';
                
                let estilo = '';
                if (arquivo === 'exame' && (header.toUpperCase() === 'RESULTADO' || header.toUpperCase().includes('STATUS'))) {
                    if (valor.toUpperCase().includes('ANORMAL') || valor.toUpperCase().includes('ELEVADO')) {
                        estilo = 'color: red; font-weight: bold; background-color: #f8d7da;';
                    } else if (valor.toUpperCase().includes('BAIXO')) {
                        estilo = 'color: orange; font-weight: bold; background-color: #ffeeba;';
                    }
                } else if (arquivo === 'alergia' && header.toUpperCase() === 'GRAVIDADE' && valor.toUpperCase() === 'GRAVE') {
                    estilo = 'color: white; font-weight: bold; background-color: #dc3545;';
                } else if (arquivo === 'imunizacao' && header.toUpperCase() === 'STATUS' && valor.toUpperCase() === 'PENDENTE') {
                    estilo = 'color: white; font-weight: bold; background-color: #ffc107;';
                }

                htmlTabela += `<td style="padding: 10px; border: 1px solid #ccc; ${estilo}">${valor}</td>`;
            });
            htmlTabela += `</tr>`;
        });
        htmlTabela += `</tbody></table>`;
    } else {
        htmlTabela = `<p style="color: #dc3545; font-style: italic; margin-top: 20px;">Nenhum dado encontrado para ${titulo}.</p>`;
    }

    dadosContainer.innerHTML = `
        <div style="padding: 20px; background: #fff; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="color: #007bff; margin: 0;">${titulo}</h2>
                <button onclick="renderizarMenu()" style="background-color: #6c757d; color: white; padding: 10px 15px; border: none; border-radius: 6px; cursor: pointer;">
                    &larr; Voltar ao Menu
                </button>
            </div>
            ${htmlTabela}
        </div>
    `;
    gerenciarMicrofone(true);
}

function resetarDadosUI() {
    dadosPacienteGlobal.ID = null;
    nomePacienteAtual = 'Paciente Não Identificado';
    alertasGerados = [];
    for (const key in dadosPacienteGlobal) {
        if (Array.isArray(dadosPacienteGlobal[key])) {
            dadosPacienteGlobal[key].length = 0; 
        }
    }
    const menuJanela = document.getElementById('menu-janela');
    const dadosContainer = document.getElementById('dados-container');
    if (menuJanela) menuJanela.innerHTML = '';
    if (dadosContainer) dadosContainer.innerHTML = '';
    
    menuJanela.classList.add('hidden');
    dadosContainer.classList.add('hidden');
    
    const header = document.getElementById('app-header');
    if (header) header.remove();
}

// --- 5. FLUXO DE DITADO ESTRUTURADO 
const TIPOS_VISITA = ['Primeira Visita', 'Retorno', 'Semestral/Anual'];

function solicitarTipoVisita() {
    const menuJanela = document.getElementById('menu-janela');
    const dadosContainer = document.getElementById('dados-container');
    
    menuJanela.classList.add('hidden');
    dadosContainer.classList.remove('hidden');

    dadosContainer.innerHTML = `
        <div style="padding: 30px; background: #fff; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); margin-top: 50px; text-align: center;">
            <h2 style="color: #6f42c1;">🎙️ Iniciar Relatório de Evolução</h2>
            <p style="font-size: 1.1em; color: #555;">Qual é o tipo de consulta que será registrada?</p>
            
            <div style="margin: 20px 0;">
                ${TIPOS_VISITA.map(tipo => `
                    <button 
                        onclick="exibirInstrucoesDitado('${tipo}')" 
                        style="padding: 15px 25px; margin: 10px; border: none; border-radius: 8px; font-size: 1.1em; cursor: pointer; background-color: #007bff; color: white; transition: background-color 0.2s;"
                    >
                        ${tipo}
                    </button>
                `).join('')}
            </div>
            <button onclick="renderizarMenu()" style="background-color: #ccc; color: #333; padding: 10px 15px; border: none; border-radius: 6px; cursor: pointer; margin-top: 20px;">
                &larr; Cancelar
            </button>
        </div>
    `;
    gerenciarMicrofone(false, 'Aguardando seleção do tipo de visita.');
}
window.solicitarTipoVisita = solicitarTipoVisita;

function exibirInstrucoesDitado(tipoVisita) {
    const dadosContainer = document.getElementById('dados-container');
    
    let protocoloEsperado = '';
    
    switch (tipoVisita) {
        case 'Primeira Visita':
            protocoloEsperado = 'Antropometria, Desenvolvimento, Rotina e Hábitos, Alergias, Comorbidades, Imunização, Queixa Principal e Exame Físico.';
            break;
        case 'Retorno':
            protocoloEsperado = 'Evolução da Queixa Principal, Resultados de Exames solicitados, Achados do Exame Físico e Plano Terapêutico (ajustes de medicamento).';
            break;
        case 'Semestral/Anual':
            protocoloEsperado = 'Revisão do Desenvolvimento Psicomotor, Rotina, Status Vacinal e Medidas Antropométricas de Acompanhamento.';
            break;
    }
    
    dadosContainer.innerHTML = `
        <div style="padding: 30px; background: #fff; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); margin-top: 50px;">
            <h2 style="color: #6f42c1;">🗣️ Protocolo de Ditado: ${tipoVisita}</h2>
            
            <div style="background: #f8f9fa; padding: 15px; border-left: 5px solid #007bff; margin: 15px 0;">
                <strong style="color: #007bff;">Protocolo PediSense (Foco Esperado):</strong>
                <p>${protocoloEsperado}</p>
            </div>
            
            <p style="font-size: 1.1em; font-weight: bold; color: #dc3545;">
                ATENÇÃO: Você pode ditar livremente, mas tente cobrir os pontos acima.
            </p>
            
            <button 
                onclick="iniciarCapturaDitadoGemini('${tipoVisita}')" 
                style="padding: 15px 30px; margin-top: 20px; border: none; border-radius: 8px; font-size: 1.2em; cursor: pointer; background-color: #28a745; color: white; font-weight: bold;"
            >
                ▶️ INICIAR DITADO
            </button>
            <button onclick="renderizarMenu()" style="background-color: #ccc; color: #333; padding: 10px 15px; border: none; border-radius: 6px; cursor: pointer; margin-left: 10px;">
                &larr; Voltar
            </button>
        </div>
    `;
    gerenciarMicrofone(false, 'Aguardando médico iniciar o ditado...');
}
window.exibirInstrucoesDitado = exibirInstrucoesDitado;


function iniciarCapturaDitadoGemini(tipoVisita) {
    const dadosContainer = document.getElementById('dados-container');
    dadosContainer.innerHTML = `
        <div style="text-align: center; padding: 50px;">
            <p style="font-size: 1.5em; color: #333;">Capturando Relatório de ${tipoVisita}...</p>
            <div id="mic-status-relatorio" style="font-size: 1.2em; color: #007bff; margin-top: 20px;">
                ... Aguardando Microfone ...
            </div>
        </div>
    `;
    
    if (typeof iniciarFluxoDitado === "function") {
        iniciarFluxoDitado(tipoVisita);
    } else {
        alert("Erro: Função de captura de ditado não encontrada no main.js. Verifique o código.");
    }
}
window.iniciarCapturaDitadoGemini = iniciarCapturaDitadoGemini;

async function salvarRelatorioGemini(idPaciente, tipoVisita, textoDitado) {
    console.log(`[GEMINI] Enviando ditado (${tipoVisita}) para análise: ${textoDitado.substring(0, 50)}...`);
    gerenciarMicrofone(false, 'Processando Análise Gemini...'); 
    
    const contextoPaciente = JSON.stringify(dadosPacienteGlobal, null, 2);
    try {
        const response = await fetch('/api/salvar-relatorio', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id_paciente: idPaciente,
                tipo_visita: tipoVisita,
                texto_ditado: textoDitado, 
                contexto_paciente: contextoPaciente 
            }),
        });

        if (!response.ok) {
            throw new Error(`Erro de rede ou servidor: ${response.status}`);
        }

        const resultado = await response.json();
        
        alert(`✅ Relatório de ${tipoVisita} salvo com sucesso no Back-end! Resumo: ${resultado.data.resumo_clinico_ger}`);
        
        renderizarMenu(); 

    } catch (error) {
        console.error("Falha na chamada Gemini/Salvar BD:", error);
        alert('⚠️ Erro ao salvar o relatório. Verifique a conexão do Back-end.');
        renderizarMenu(); 
    }
    gerenciarMicrofone(true); 
}
window.salvarRelatorioGemini = salvarRelatorioGemini; // Expõe para o main.js
window.resetarDadosUI = resetarDadosUI;
