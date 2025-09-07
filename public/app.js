document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:3000';

    // --- Seletores de Elementos ---
    const btnAbrirModal = document.getElementById('btnAbrirModal');
    const btnFecharModal = document.getElementById('btnFecharModal');
    const modal = document.getElementById('modalLancamento');
    const form = document.getElementById('formLancamento');
    const btnAdicionarPartida = document.getElementById('btnAdicionarPartida');
    const partidasContainer = document.getElementById('partidasContainer');
    const totalDebitoEl = document.getElementById('totalDebito');
    const totalCreditoEl = document.getElementById('totalCredito');
    const btnSalvar = document.getElementById('btnSalvar');
    const corpoTabela = document.getElementById('corpo-tabela-lancamentos');
    const totalDebitoTabela = document.getElementById('total-debito-tabela');
    const totalCreditoTabela = document.getElementById('total-credito-tabela');

    let planoDeContas = [];

    // --- Funções Auxiliares (Declaradas Primeiro para Corrigir o Bug) ---

    // Mostra uma notificação "toast"
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) {
            console.error('Toast container not found!');
            alert(message); // Fallback para alert se o container não existir
            return;
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // --- Funções Principais de Lógica ---

    // Busca e renderiza as partidas na tabela principal
    async function carregarPartidas() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/partidas`);
            if (!response.ok) throw new Error('Falha ao carregar lançamentos.');
            const partidas = await response.json();

            corpoTabela.innerHTML = ''; // Limpa a tabela antes de preencher
            let totalDebito = 0;
            let totalCredito = 0;

            const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

            partidas.forEach(partida => {
                const tr = document.createElement('tr');
                const valorFormatado = formatadorMoeda.format(partida.valor);

                const debitoTd = (partida.tipo_partida === 'D') ? valorFormatado : '';
                const creditoTd = (partida.tipo_partida === 'C') ? valorFormatado : '';
                
                if (partida.tipo_partida === 'D') totalDebito += parseFloat(partida.valor);
                if (partida.tipo_partida === 'C') totalCredito += parseFloat(partida.valor);

                tr.innerHTML = `
                    <td>${partida.codigo_conta}</td>
                    <td>${partida.nome_conta}</td>
                    <td class="valor">${debitoTd}</td>
                    <td class="valor">${creditoTd}</td>
                `;
                corpoTabela.appendChild(tr);
            });

            totalDebitoTabela.textContent = formatadorMoeda.format(totalDebito);
            totalCreditoTabela.textContent = formatadorMoeda.format(totalCredito);

        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        }
    }

    // Busca o plano de contas da API
    async function carregarDadosIniciais() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/plano-contas`);
            if (!response.ok) throw new Error('Não foi possível carregar o plano de contas.');
            planoDeContas = await response.json();
            showToast('Plano de contas carregado!', 'success');
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        }
    }

    // Adiciona uma nova linha de partida
    function adicionarNovaPartida() {
        const partidaId = Date.now();
        const partidaDiv = document.createElement('div');
        partidaDiv.className = 'partida-item';
        partidaDiv.dataset.id = partidaId;
        partidaDiv.innerHTML = `
            <div class="autocomplete-container">
                <input type="text" class="conta-search" placeholder="Clique ou digite para buscar a conta...">
                <input type="hidden" class="conta-id">
                <input type="hidden" class="conta-tipo">
                <div class="autocomplete-suggestions"></div>
            </div>
            <input type="number" class="valor-debito" placeholder="Débito" min="0" step="0.01">
            <input type="number" class="valor-credito" placeholder="Crédito" min="0" step="0.01">
            <button type="button" class="btn-remove">&times;</button>
        `;
        partidasContainer.appendChild(partidaDiv);
    }

    // Mostra sugestões de autocompletar
    function mostrarSugestoes(input) {
        const valor = input.value.toLowerCase();
        const containerSugestoes = input.parentElement.querySelector('.autocomplete-suggestions');
        
        document.querySelectorAll('.autocomplete-suggestions').forEach(sug => {
            if (sug !== containerSugestoes) sug.innerHTML = '';
        });
        
        containerSugestoes.innerHTML = '';
        
        const sugestoes = planoDeContas.filter(c => 
            c.nome_conta.toLowerCase().includes(valor) || c.codigo_conta.startsWith(valor)
        ).slice(0, 15);

        sugestoes.forEach(conta => {
            const item = document.createElement('div');
            const prefixo = conta.tipo_conta === 'SINTETICA' ? '[S]' : '[A]';
            item.innerHTML = `${prefixo} ${conta.codigo_conta} - ${conta.nome_conta.replace(new RegExp(valor, 'gi'), `<strong>${valor}</strong>`)}`;
            
            item.addEventListener('click', () => {
                input.value = `${prefixo} ${conta.codigo_conta} - ${conta.nome_conta}`;
                input.parentElement.querySelector('.conta-id').value = conta.id;
                input.parentElement.querySelector('.conta-tipo').value = conta.tipo_conta;
                containerSugestoes.innerHTML = '';
            });
            containerSugestoes.appendChild(item);
        });
    }

    // Atualiza os totais e o estado do botão salvar
    function atualizarTotais() {
        let totalDebito = 0, totalCredito = 0;
        document.querySelectorAll('.partida-item').forEach(item => {
            totalDebito += parseFloat(item.querySelector('.valor-debito').value) || 0;
            totalCredito += parseFloat(item.querySelector('.valor-credito').value) || 0;
        });

        totalDebitoEl.textContent = totalDebito.toFixed(2);
        totalCreditoEl.textContent = totalCredito.toFixed(2);
        
        const diferenca = Math.abs(totalDebito - totalCredito);
        const totaisIguais = diferenca < 0.001;

        totalDebitoEl.classList.toggle('error', !totaisIguais);
        totalCreditoEl.classList.toggle('error', !totaisIguais);
        btnSalvar.disabled = !totaisIguais || totalDebito === 0;
    }

    // --- Event Listeners ---
    btnAbrirModal.addEventListener('click', () => {
        form.reset();
        partidasContainer.innerHTML = '';
        adicionarNovaPartida();
        adicionarNovaPartida();
        atualizarTotais();
        modal.style.display = 'flex';
        document.getElementById('dataLancamento').valueAsDate = new Date();
    });

    btnFecharModal.addEventListener('click', () => modal.style.display = 'none');
    btnAdicionarPartida.addEventListener('click', adicionarNovaPartida);

    partidasContainer.addEventListener('focusin', e => {
        if (e.target.classList.contains('conta-search')) {
            mostrarSugestoes(e.target);
        }
    });
    
    partidasContainer.addEventListener('input', e => {
        if (e.target.classList.contains('conta-search')) {
            mostrarSugestoes(e.target);
        }
        if (e.target.classList.contains('valor-debito') || e.target.classList.contains('valor-credito')) {
            const partidaItem = e.target.closest('.partida-item');
            if (e.target.classList.contains('valor-debito') && e.target.value > 0) {
                partidaItem.querySelector('.valor-credito').value = '';
            } else if (e.target.classList.contains('valor-credito') && e.target.value > 0) {
                partidaItem.querySelector('.valor-debito').value = '';
            }
            atualizarTotais();
        }
    });

    partidasContainer.addEventListener('click', e => {
        if (e.target.classList.contains('btn-remove')) {
            e.target.closest('.partida-item').remove();
            atualizarTotais();
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-container')) {
            document.querySelectorAll('.autocomplete-suggestions').forEach(sug => sug.innerHTML = '');
        }
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        btnSalvar.disabled = true;
        btnSalvar.querySelector('.spinner').style.display = 'inline-block';
        btnSalvar.querySelector('.btn-text').textContent = 'Salvando...';

        const partidas = [];
        let formValido = true;
        document.querySelectorAll('.partida-item').forEach(item => {
            const id_conta = parseInt(item.querySelector('.conta-id').value);
            const tipo_conta = item.querySelector('.conta-tipo').value;
            const valorDebito = parseFloat(item.querySelector('.valor-debito').value) || 0;
            const valorCredito = parseFloat(item.querySelector('.valor-credito').value) || 0;

            if (valorDebito > 0 || valorCredito > 0) {
                if (!id_conta || tipo_conta !== 'ANALITICA') {
                    formValido = false;
                }
            }
            
            if (id_conta && (valorDebito > 0 || valorCredito > 0)) {
                if (valorDebito > 0) partidas.push({ id_conta, tipo: 'D', valor: valorDebito });
                else if (valorCredito > 0) partidas.push({ id_conta, tipo: 'C', valor: valorCredito });
            }
        });

        if (!formValido) {
            showToast('Lançamentos com valor devem ter uma conta analítica [A] selecionada.', 'error');
        } else {
            const lancamento = {
                data_lancamento: document.getElementById('dataLancamento').value,
                historico: document.getElementById('historico').value,
                partidas,
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/lancamentos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(lancamento),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                
                showToast('Lançamento salvo com sucesso!', 'success');
                modal.style.display = 'none';
                carregarPartidas(); // ATUALIZA A TABELA PRINCIPAL
            } catch (error) {
                showToast(error.message, 'error');
            }
        }
        
        btnSalvar.disabled = false;
        btnSalvar.querySelector('.spinner').style.display = 'none';
        btnSalvar.querySelector('.btn-text').textContent = 'Salvar Lançamento';
    });

    // --- INICIALIZAÇÃO ---
    async function inicializarApp() {
        await carregarDadosIniciais(); // Carrega o plano de contas primeiro
        carregarPartidas(); // Depois carrega os lançamentos existentes
    }

    inicializarApp();
});
