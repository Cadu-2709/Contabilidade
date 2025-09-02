document.addEventListener('DOMContentLoaded', () => {
    // ---- Variáveis Globais e Seletores de Elementos ----
    const btnAbrirModal = document.getElementById('btnAbrirModal');
    const btnFecharModal = document.getElementById('btnFecharModal');
    const modal = document.getElementById('modalLancamento');
    const form = document.getElementById('formLancamento');
    const btnAdicionarPartida = document.getElementById('btnAdicionarPartida');
    const partidasContainer = document.getElementById('partidasContainer');
    const totalDebitoEl = document.getElementById('totalDebito');
    const totalCreditoEl = document.getElementById('totalCredito');
    const btnSalvar = document.getElementById('btnSalvar');

    let planoDeContas = []; // Armazena todas as contas para evitar buscas repetidas

    // ---- Funções ----

    // Busca o plano de contas da API
    async function fetchPlanoContas() {
        try {
            const response = await fetch('/api/plano-contas');
            if (!response.ok) throw new Error('Erro ao buscar contas');
            planoDeContas = await response.json();
        } catch (error) {
            console.error(error);
            alert('Não foi possível carregar o plano de contas.');
        }
    }

    // Cria e adiciona uma nova linha de partida (débito/crédito)
    function adicionarNovaPartida() {
        const partidaId = Date.now(); // ID único para a linha
        const partidaDiv = document.createElement('div');
        partidaDiv.className = 'partida-item';
        partidaDiv.dataset.id = partidaId;

        partidaDiv.innerHTML = `
            <div class="conta-select-container" data-partida-id="${partidaId}">
                </div>
            <input type="number" class="valor-debito" placeholder="Débito" min="0" step="0.01">
            <input type="number" class="valor-credito" placeholder="Crédito" min="0" step="0.01">
            <button type="button" class="btn-remove">&times;</button>
        `;

        partidasContainer.appendChild(partidaDiv);
        criarDropdownCascata(partidaId, null); // Inicia o primeiro dropdown
    }

    // Cria o sistema de dropdowns em cascata para uma linha de partida
    function criarDropdownCascata(partidaId, idPai) {
        const container = document.querySelector(`.conta-select-container[data-partida-id="${partidaId}"]`);
        
        const contasFilhas = planoDeContas.filter(c => c.id_conta_pai === idPai);
        
        if (contasFilhas.length > 0) {
            const select = document.createElement('select');
            select.innerHTML = `<option value="">Selecione...</option>`;
            
            contasFilhas.forEach(conta => {
                const prefixo = conta.tipo_conta === 'SINTETICA' ? '[S] ' : '[A] ';
                select.innerHTML += `<option value="${conta.id}" data-tipo="${conta.tipo_conta}">${prefixo}${conta.codigo_conta} - ${conta.nome_conta}</option>`;
            });

            select.addEventListener('change', (e) => {
                // Remove dropdowns filhos que possam existir
                let nextSibling = e.target.nextElementSibling;
                while (nextSibling) {
                    nextSibling.remove();
                    nextSibling = e.target.nextElementSibling;
                }

                const selectedId = parseInt(e.target.value);
                const selectedOption = e.target.options[e.target.selectedIndex];
                const tipo = selectedOption.dataset.tipo;

                // Se for sintética, cria o próximo nível
                if (tipo === 'SINTETICA') {
                    criarDropdownCascata(partidaId, selectedId);
                }
            });

            container.appendChild(select);
        }
    }

    // Atualiza os totais de débito e crédito
    function atualizarTotais() {
        let totalDebito = 0;
        let totalCredito = 0;

        document.querySelectorAll('.partida-item').forEach(item => {
            const debito = parseFloat(item.querySelector('.valor-debito').value) || 0;
            const credito = parseFloat(item.querySelector('.valor-credito').value) || 0;
            totalDebito += debito;
            totalCredito += credito;
        });

        totalDebitoEl.textContent = totalDebito.toFixed(2);
        totalCreditoEl.textContent = totalCredito.toFixed(2);
        
        // Habilita/desabilita o botão salvar
        btnSalvar.disabled = (Math.abs(totalDebito - totalCredito) > 0.001 || totalDebito === 0);
    }
    
    // ---- Event Listeners ----

    btnAbrirModal.addEventListener('click', () => {
        form.reset();
        partidasContainer.innerHTML = '';
        atualizarTotais();
        adicionarNovaPartida();
        adicionarNovaPartida(); // Começa com duas linhas
        modal.style.display = 'flex';
    });

    btnFecharModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    btnAdicionarPartida.addEventListener('click', adicionarNovaPartida);

    partidasContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            e.target.closest('.partida-item').remove();
            atualizarTotais();
        }
    });

    partidasContainer.addEventListener('input', (e) => {
        // Garante que só um campo (débito ou crédito) seja preenchido por linha
        if (e.target.classList.contains('valor-debito') && e.target.value > 0) {
            e.target.closest('.partida-item').querySelector('.valor-credito').value = '';
        } else if (e.target.classList.contains('valor-credito') && e.target.value > 0) {
            e.target.closest('.partida-item').querySelector('.valor-debito').value = '';
        }
        atualizarTotais();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const partidas = [];
        let formValido = true;
        
        document.querySelectorAll('.partida-item').forEach(item => {
            const selects = item.querySelectorAll('select');
            const ultimoSelect = selects[selects.length - 1];
            
            // Valida se a última conta selecionada é analítica
            const tipo = ultimoSelect.options[ultimoSelect.selectedIndex]?.dataset.tipo;
            if (!ultimoSelect.value || tipo !== 'ANALITICA') {
                formValido = false;
                return;
            }

            const id_conta = parseInt(ultimoSelect.value);
            const valorDebito = parseFloat(item.querySelector('.valor-debito').value) || 0;
            const valorCredito = parseFloat(item.querySelector('.valor-credito').value) || 0;

            if (valorDebito > 0) {
                partidas.push({ id_conta, tipo: 'D', valor: valorDebito });
            } else if (valorCredito > 0) {
                partidas.push({ id_conta, tipo: 'C', valor: valorCredito });
            }
        });

        if (!formValido) {
            alert('Por favor, selecione uma conta analítica [A] para todas as partidas.');
            return;
        }

        const lancamento = {
            data_lancamento: document.getElementById('dataLancamento').value,
            historico: document.getElementById('historico').value,
            partidas: partidas,
        };

        try {
            const response = await fetch('/api/lancamentos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lancamento),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message);
            }

            alert('Lançamento salvo com sucesso!');
            modal.style.display = 'none';

        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert(`Erro: ${error.message}`);
        }
    });

    // ---- Inicialização ----
    fetchPlanoContas();
});