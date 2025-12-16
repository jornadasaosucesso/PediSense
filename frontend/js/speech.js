// ===== Comandos clínicos =====
// Encapsulado para evitar redeclaração se o arquivo for carregado mais de uma vez
window.COMANDOS_CLINICOS = window.COMANDOS_CLINICOS || [
  { palavra: "paciente", acao: "BUSCAR_PACIENTE", emoji: "👶" },
  { palavra: "alergias", acao: "EXIBIR_ALERGIAS", emoji: "⚠️" },
  { palavra: "comorbidade", acao: "EXIBIR_COMORBIDADE", emoji: "🩺" },
  { palavra: "curva", acao: "EXIBIR_CURVA", emoji: "📈" },
  { palavra: "exames", acao: "SOLICITAR_EXAMES", emoji: "🧪" },
  { palavra: "medicamentos", acao: "ABRIR_PRESCRICAO", emoji: "💊" },
  { palavra: "evolução", acao: "INICIAR_DITACAO", emoji: "📝" },
  { palavra: "menu", acao: "ABRIR_MENU", emoji: "💡" }
];

window.recognitionComandos = window.recognitionComandos || null;
window.pacienteAtual = window.pacienteAtual || { nome: null, id: null, alertas: [] };
window.estadoEscuta = window.estadoEscuta || "menu"; // menu | coleta_nome | aguarda_sair

// ===== Inicializa escuta contínua =====
function iniciarEscutaComandos() {
  if (!("webkitSpeechRecognition" in window)) {
    console.error("Reconhecimento de fala não suportado neste navegador.");
    return;
  }

  window.recognitionComandos = new webkitSpeechRecognition();
  recognitionComandos.continuous = true;
  recognitionComandos.interimResults = false;
  recognitionComandos.lang = "pt-BR";

  recognitionComandos.onresult = (event) => {
    try { console.timeEnd("wakeword"); } catch {}
    const last = event.results[event.results.length - 1];
    const transcricao = last[0][0].transcript.toLowerCase().trim();
    console.log(`[PediSense Ouviu]: ${transcricao}`);
    processarComando(transcricao);
  };

  recognitionComandos.onerror = (event) => {
    console.error("Erro no reconhecimento de comandos:", event.error);
    if (event.error === "no-speech") {
      try { recognitionComandos.start(); } catch {}
    }
  };

  recognitionComandos.onend = () => {
    const mainAtivo = document.getElementById("main-app")?.classList.contains("active");
    if (mainAtivo) recognitionComandos.start();
  };

  console.time("wakeword");
  recognitionComandos.start();
}

// ===== Processa comandos por voz =====
function processarComando(transcricao) {
  // 1. Coleta de nome
  if (estadoEscuta === "coleta_nome") {
    executarBuscaPaciente(transcricao);
    estadoEscuta = "menu";
    return;
  }

  // 2. Sair da tela de detalhes
  if (estadoEscuta === "aguarda_sair" && transcricao.includes("sair")) {
    fecharTelaPaciente();
    estadoEscuta = "menu";
    return;
  }

  // 3. Carregamento de paciente
  if (transcricao.includes("paciente")) {
    const nomeFalado = transcricao.replace(/^.*paciente\s+/i, "").trim();

    if (nomeFalado.length > 0) {
      console.log("vai buscar paciente:", nomeFalado);
      executarBuscaPaciente(nomeFalado);
      return;
    } else {
      const fala = new SpeechSynthesisUtterance("Nome do paciente?");
      fala.lang = "pt-BR";
      speechSynthesis.speak(fala);
      estadoEscuta = "coleta_nome";
      return;
    }
  }

  // 4. Comandos clínicos
  for (const comando of COMANDOS_CLINICOS) {
    if (transcricao.includes(comando.palavra)) {
      executarAcaoClinica(comando.acao);
      return;
    }
  }

  // 5. Vigilância silenciosa
  if (pacienteAtual.id) {
    verificarVigilanciaSilenciosa(transcricao);
  }
}

// ===== Execuções (CSV com PapaParse) =====
async function executarBuscaPaciente(nomeFalado) {
  try {
    const caminhoCSV = "assets/dados/prontuario.csv"; // ajuste conforme sua pasta

    const nomeFaladoNormalizado = nomeFalado
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim();

    if (typeof Papa === "undefined") {
      console.error("PapaParse não carregado. Inclua js/libs/papaparse.min.js antes de speech.js.");
      return;
    }

    Papa.parse(caminhoCSV, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function(resultado) {
        console.log("Linhas carregadas:", resultado.data.length);

        let pacienteEncontrado = null;

        for (const registro of resultado.data) {
          const gatilhos = [
            registro.gatilho1,
            registro.gatilho2,
            registro.gatilho3
          ].map(g => (g || "")
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .trim()
          );

          if (gatilhos.includes(nomeFaladoNormalizado)) {
            pacienteEncontrado = registro;
            break;
          }
        }

        // fallback: tentar pelo campo nome
        if (!pacienteEncontrado) {
          const tentativaPorNome = resultado.data.find(r =>
            (r?.nome || "").toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              .trim() === nomeFaladoNormalizado
          );
          if (tentativaPorNome) pacienteEncontrado = tentativaPorNome;
        }

        if (!pacienteEncontrado) {
          console.error("Paciente não encontrado no CSV:", nomeFalado);
          return;
        }

        pacienteAtual = pacienteEncontrado;

        // Renderiza ficha inicial
        const detalhes = document.getElementById("paciente-detalhes");
        if (detalhes) {
          detalhes.innerHTML = `
            <div class="modal">
              <h2>Paciente: ${pacienteAtual.nome}</h2>
              <p><strong>Data Nasc.:</strong> ${pacienteAtual.data_nasc}</p>
              <p><strong>Pai:</strong> ${pacienteAtual.filiacaoPai}</p>
              <p><strong>Mãe:</strong> ${pacienteAtual.filiacaoMae}</p>
              <p><strong>Plano de Saúde:</strong> ${pacienteAtual.planoSaude}</p>
              <p><strong>Nascimento:</strong> ${pacienteAtual.nascimento}</p>
              <p><strong>Imunização:</strong> ${pacienteAtual.imunizacao}</p>
              <p><em>Diga "SAIR" para voltar ao menu.</em></p>
            </div>
          `;
          detalhes.classList.add("ativo");
        }

        const fala = new SpeechSynthesisUtterance(
          `Prontuário de ${pacienteAtual.nome} carregado. Diga SAIR para retornar ao menu.`
        );
        fala.lang = "pt-BR";
        speechSynthesis.speak(fala);

        estadoEscuta = "aguarda_sair";
      },
      error: function(err) {
        console.error("Erro PapaParse:", err);
      }
    });

  } catch (err) {
    console.error("Erro ao carregar CSV:", err);
  }
}

function fecharTelaPaciente() {
  const detalhes = document.getElementById("paciente-detalhes");
  if (detalhes) {
    detalhes.innerHTML = "";
    detalhes.classList.remove("ativo");
  }

  if (typeof renderizarMenu === "function") renderizarMenu();
  estadoEscuta = "menu";
}

function executarAcaoClinica(acao) {
  if (!pacienteAtual.id) {
    console.error("Nenhum paciente carregado. Diga 'PACIENTE' para iniciar e informe o nome.");
    return;
  }
  console.log(`Ação Clínica: ${acao} para ${pacienteAtual.nome}`);
}

// ===== Vigilância silenciosa =====
function verificarVigilanciaSilenciosa(transcricao) {
  for (const risco of pacienteAtual.alertas) {
    if (transcricao.includes(risco)) {
      acionarAlertaDeRisco(risco);
      break;
    }
  }
}

function acionarAlertaDeRisco(alergia) {
  console.error(`!!! VIGILÂNCIA: ALERGIA GRAVE a ${alergia.toUpperCase()} !!!`);

  const alerta = document.getElementById("alerta-risco");
  if (alerta) {
    alerta.innerHTML = `⚠️ <strong>RISCO:</strong> Paciente ALÉRGICO a ${alergia.toUpperCase()}! Verifique a prescrição.`;
    alerta.classList.remove("alerta-vermelho-inativo");
    alerta.classList.add("alerta-vermelho-ativo");

    setTimeout(() => {
      alerta.classList.remove("alerta-vermelho-ativo");
      alerta.classList.add("alerta-vermelho-inativo");
    }, 6000);
  }
}

// ===== Exporta =====
window.iniciarEscutaComandos = iniciarEscutaComandos;