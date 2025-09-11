const db = require('../database/db');
const PDFDocument = require('pdfkit');

// --- FUNÇÃO AUXILIAR PARA MONTAR HIERARQUIA ---
function buildHierarchy(items, parentId = null) {
    const branch = [];
    items
        .filter(item => item.id_conta_pai === parentId)
        .forEach(item => {
            const children = buildHierarchy(items, item.id);
            if (children.length > 0) {
                item.children = children;
                for (let i = 0; i < 12; i++) {
                    item.meses[i] = children.reduce((acc, child) => acc + (child.meses[i] || 0), 0);
                }
                item.total_ano = children.reduce((acc, child) => acc + (child.total_ano || 0), 0);
            }
            branch.push(item);
        });
    return branch;
}

// --- FUNÇÃO AUXILIAR PARA DESENHAR O PDF ---
function drawPdfTable(doc, reportName, ano, reportData) {
    doc.fontSize(16).font('Helvetica-Bold').text(`Relatório: ${reportName} - Ano ${ano}`, { align: 'center' });
    doc.moveDown(2);
    const tableTop = doc.y;
    const rowHeight = 18;
    const colWidths = [240, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 60];
    const colStarts = [30];
    for(let i = 1; i < colWidths.length; i++) colStarts.push(colStarts[i-1] + colWidths[i-1]);
    const headers = ['Conta', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Total'];
    doc.font('Helvetica-Bold').fontSize(8);
    headers.forEach((header, i) => {
        doc.text(header, colStarts[i], tableTop, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
    });
    doc.y += rowHeight;
    const formatadorMoeda = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    function drawRows(contas, nivel = 0) {
        doc.font(nivel === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
        const indent = nivel * 15;
        for (const conta of contas) {
            if (doc.y > 520) { doc.addPage({ layout: 'landscape', size: 'A4', margin: 30 }); doc.y = 30; }
            doc.text(`${conta.codigo_conta} - ${conta.nome_conta}`, colStarts[0] + indent, doc.y, { width: colWidths[0] - indent });
            (conta.meses || []).forEach((valor, i) => {
                doc.text(formatadorMoeda.format(valor), colStarts[i + 1], doc.y, { width: colWidths[i + 1], align: 'right' });
            });
            doc.font('Helvetica-Bold').text(formatadorMoeda.format(conta.total_ano), colStarts[13], doc.y, { width: colWidths[13], align: 'right' });
            doc.font('Helvetica').y += rowHeight;
            if (conta.children && conta.children.length > 0) {
                drawRows(conta.children, nivel + 1);
            }
        }
    }
    drawRows(reportData);
}

// --- CONTROLLERS ---

const getDre = async (req, res) => {
    try {
        const { ano } = req.query;
        if (!ano) return res.status(400).json({ message: 'O ano é obrigatório.' });
        
        // Passo 1: Pega a estrutura das contas de resultado
        const contasResult = await db.query("SELECT * FROM sistema_contabil.plano_contas WHERE codigo_conta LIKE '4%' ORDER BY codigo_conta");
        let dreAccounts = contasResult.rows;

        // Passo 2: Pega TODOS os lançamentos do ano
        const lancamentosResult = await db.query(
            `SELECT p.id_conta_contabil, EXTRACT(MONTH FROM ll.data_lancamento) as mes, p.tipo_partida, p.valor 
             FROM sistema_contabil.partidas_dobradas p
             JOIN sistema_contabil.lotes_lancamentos ll ON p.id_lote = ll.id
             WHERE EXTRACT(YEAR FROM ll.data_lancamento) = $1`,
            [ano]
        );
        const lancamentos = lancamentosResult.rows;

        // Passo 3: Processa os dados em JavaScript
        const processedList = dreAccounts.map(conta => {
            const meses = Array(12).fill(0);
            let total_ano = 0;
            const fator = conta.natureza_conta === 'CREDORA' ? 1 : -1; // Receitas (C) são positivas, Despesas (D) são negativas

            lancamentos
                // .filter(l => l.id_conta_contabil === conta.id)
                .forEach(l => {
                    const valor = parseFloat(l.valor) * (l.tipo_partida === 'C' ? 1 : -1);
                    meses[l.mes - 1] += valor * fator;
                });

            total_ano = meses.reduce((a, b) => a + b, 0);
            return { ...conta, meses, total_ano, children: [] };
        });

        // Passo 4: Monta a hierarquia
        const contaRaiz = processedList.find(c => c.codigo_conta === '4');
        const dreHierarquica = buildHierarchy(processedList, contaRaiz ? contaRaiz.id : null);
        
        res.json(dreHierarquica);
    } catch (error) {
        console.error('Erro ao gerar DRE JSON:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

const getDrePdf = async (req, res) => {
    // A lógica para o PDF agora é idêntica à da DRE em tela
    try {
        const { ano } = req.query;
        if (!ano) return res.status(400).json({ message: 'O ano é obrigatório.' });
        
        const contasResult = await db.query("SELECT * FROM sistema_contabil.plano_contas WHERE codigo_conta LIKE '4%' ORDER BY codigo_conta");
        let dreAccounts = contasResult.rows;

        const lancamentosResult = await db.query(
            `SELECT p.id_conta_contabil, EXTRACT(MONTH FROM ll.data_lancamento) as mes, p.tipo_partida, p.valor 
             FROM sistema_contabil.partidas_dobradas p
             JOIN sistema_contabil.lotes_lancamentos ll ON p.id_lote = ll.id
             WHERE EXTRACT(YEAR FROM ll.data_lancamento) = $1`,
            [ano]
        );
        const lancamentos = lancamentosResult.rows;

        const processedList = dreAccounts.map(conta => {
            const meses = Array(12).fill(0);
            let total_ano = 0;
            const fator = conta.natureza_conta === 'CREDORA' ? 1 : -1;
            lancamentos
                .filter(l => l.id_conta_contabil === conta.id)
                .forEach(l => {
                    const valor = parseFloat(l.valor) * (l.tipo_partida === 'C' ? 1 : -1);
                    meses[l.mes - 1] += valor * fator;
                });
            total_ano = meses.reduce((a, b) => a + b, 0);
            return { ...conta, meses, total_ano, children: [] };
        });

        const contaRaiz = processedList.find(c => c.codigo_conta === '4');
        const dreHierarquica = buildHierarchy(processedList, contaRaiz ? contaRaiz.id : null);
        
        const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 30 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="DRE-${ano}.pdf"`);
        doc.pipe(res);
        drawPdfTable(doc, 'DRE', ano, dreHierarquica);
        doc.end();
    } catch (error) {
        console.error('Erro ao gerar DRE PDF:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

const getBalancete = async (req, res) => {
    try {
        const { ano } = req.query;
        if (!ano) return res.status(400).json({ message: 'O ano é obrigatório.' });

        // Passo 1: Pega a estrutura de TODAS as contas
        const contasResult = await db.query("SELECT * FROM sistema_contabil.plano_contas ORDER BY codigo_conta");
        const todasContas = contasResult.rows;

        // Passo 2: Pega TODOS os lançamentos do ano
        const lancamentosResult = await db.query(
            `SELECT p.id_conta_contabil, EXTRACT(MONTH FROM ll.data_lancamento) as mes, p.tipo_partida, p.valor 
             FROM sistema_contabil.partidas_dobradas p
             JOIN sistema_contabil.lotes_lancamentos ll ON p.id_lote = ll.id
             WHERE EXTRACT(YEAR FROM ll.data_lancamento) = $1`,
            [ano]
        );
        const lancamentos = lancamentosResult.rows;
        
        // Passo 3: Processa os dados em JavaScript
        const processedList = todasContas.map(conta => {
            const meses = Array(12).fill(0);
            let total_ano = 0;
            const fator = conta.natureza_conta === 'DEVEDORA' ? 1 : -1;

            lancamentos
                .filter(l => l.id_conta_contabil === conta.id)
                .forEach(l => {
                    const valor = parseFloat(l.valor) * (l.tipo_partida === 'D' ? 1 : -1);
                    meses[l.mes - 1] += valor * fator;
                });

            total_ano = meses.reduce((a, b) => a + b, 0);
            return { ...conta, meses, total_ano, children: [] };
        });
        
        // Passo 4: Monta a hierarquia completa
        const balanceteHierarquico = buildHierarchy(processedList, null);
        res.json(balanceteHierarquico);
    } catch (error) {
        console.error('Erro ao gerar Balancete JSON:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

module.exports = { getDre, getDrePdf, getBalancete };