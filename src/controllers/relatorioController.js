const db = require('../database/db');
const PDFDocument = require('pdfkit');

// --- FUNÇÃO AUXILIAR REUTILIZÁVEL ---
async function fetchAndBuildDreData(ano) {
    const dreDataQuery = `
        SELECT 
            pc.id, pc.natureza_conta,
            SUM(CASE WHEN EXTRACT(MONTH FROM ll.data_lancamento) = 1 THEN p.valor ELSE 0 END) as mes_1,
            SUM(CASE WHEN EXTRACT(MONTH FROM ll.data_lancamento) = 2 THEN p.valor ELSE 0 END) as mes_2,
            SUM(CASE WHEN EXTRACT(MONTH FROM ll.data_lancamento) = 3 THEN p.valor ELSE 0 END) as mes_3,
            SUM(CASE WHEN EXTRACT(MONTH FROM ll.data_lancamento) = 4 THEN p.valor ELSE 0 END) as mes_4,
            SUM(CASE WHEN EXTRACT(MONTH FROM ll.data_lancamento) = 5 THEN p.valor ELSE 0 END) as mes_5,
            SUM(CASE WHEN EXTRACT(MONTH FROM ll.data_lancamento) = 6 THEN p.valor ELSE 0 END) as mes_6,
            SUM(CASE WHEN EXTRACT(MONTH FROM ll.data_lancamento) = 7 THEN p.valor ELSE 0 END) as mes_7,
            SUM(CASE WHEN EXTRACT(MONTH FROM ll.data_lancamento) = 8 THEN p.valor ELSE 0 END) as mes_8,
            SUM(CASE WHEN EXTRACT(MONTH FROM ll.data_lancamento) = 9 THEN p.valor ELSE 0 END) as mes_9,
            SUM(CASE WHEN EXTRACT(MONTH FROM ll.data_lancamento) = 10 THEN p.valor ELSE 0 END) as mes_10,
            SUM(CASE WHEN EXTRACT(MONTH FROM ll.data_lancamento) = 11 THEN p.valor ELSE 0 END) as mes_11,
            SUM(CASE WHEN EXTRACT(MONTH FROM ll.data_lancamento) = 12 THEN p.valor ELSE 0 END) as mes_12
        FROM sistema_contabil.partidas_dobradas p
        JOIN sistema_contabil.plano_contas pc ON p.id_conta_contabil = pc.id
        JOIN sistema_contabil.lotes_lancamentos ll ON p.id_lote = ll.id
        WHERE pc.codigo_conta LIKE '4.%' AND EXTRACT(YEAR FROM ll.data_lancamento) = $1
        GROUP BY pc.id, pc.natureza_conta;
    `;
    const dreDataResult = await db.query(dreDataQuery, [ano]);
    
    const dadosPorConta = {};
    for (const row of dreDataResult.rows) {
        const fator = (row.natureza_conta === 'DEVEDORA') ? -1 : 1;
        const meses = [];
        let total_ano = 0;
        for (let i = 1; i <= 12; i++) {
            const valorMes = parseFloat(row[`mes_${i}`]) * fator;
            meses.push(valorMes);
            total_ano += valorMes;
        }
        dadosPorConta[row.id] = { meses, total_ano };
    }
    
    const contasQuery = `SELECT id, id_conta_pai, codigo_conta, nome_conta FROM sistema_contabil.plano_contas WHERE codigo_conta LIKE '4.%' ORDER BY codigo_conta;`;
    const contasResult = await db.query(contasQuery);
    const contasEstrutura = contasResult.rows;

    function buildHierarchy(parentId = null) {
        const branch = [];
        const contasFilhas = contasEstrutura.filter(c => c.id_conta_pai === parentId);
        for (const conta of contasFilhas) {
            const node = { ...conta, children: [], ...dadosPorConta[conta.id] };
            if (!dadosPorConta[conta.id]) {
                node.meses = Array(12).fill(0);
                node.total_ano = 0;
            }
            const children = buildHierarchy(conta.id);
            if (children.length > 0) {
                node.children = children;
                for (let i = 0; i < 12; i++) {
                    node.meses[i] = children.reduce((acc, child) => acc + child.meses[i], 0);
                }
                node.total_ano = children.reduce((acc, child) => acc + child.total_ano, 0);
            }
            branch.push(node);
        }
        return branch;
    }
    const contaRaiz = contasEstrutura.find(c => c.codigo_conta === '4');
    return buildHierarchy(contaRaiz ? contaRaiz.id : null);
}

// --- CONTROLLERS ---
const getDre = async (req, res) => {
    const { ano } = req.query;
    if (!ano) return res.status(400).json({ message: 'O ano é obrigatório.' });
    try {
        const dreHierarquica = await fetchAndBuildDreData(ano);
        res.json(dreHierarquica);
    } catch (error) {
        console.error('Erro ao gerar DRE JSON:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

const getDrePdf = async (req, res) => {
    const { ano } = req.query;
    if (!ano) return res.status(400).json({ message: 'O ano é obrigatório.' });
    try {
        const dreData = await fetchAndBuildDreData(ano);
        const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 30 });
        const filename = `DRE-${ano}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);
        doc.fontSize(16).font('Helvetica-Bold').text(`Demonstração do Resultado do Exercício (DRE) - Ano ${ano}`, { align: 'center' });
        doc.moveDown(2);
        const tableTop = doc.y;
        const rowHeight = 20;
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
        function drawDreRows(contas, nivel = 0) {
            doc.font(nivel === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
            const indent = nivel * 15;
            for (const conta of contas) {
                if (doc.y > 500) doc.addPage({ layout: 'landscape', size: 'A4', margin: 30 });
                doc.text(`${conta.codigo_conta} - ${conta.nome_conta}`, colStarts[0] + indent, doc.y, { width: colWidths[0] - indent });
                conta.meses.forEach((valor, i) => {
                    doc.text(formatadorMoeda.format(valor), colStarts[i + 1], doc.y, { width: colWidths[i + 1], align: 'right' });
                });
                doc.font('Helvetica-Bold').text(formatadorMoeda.format(conta.total_ano), colStarts[13], doc.y, { width: colWidths[13], align: 'right' });
                doc.font('Helvetica').y += rowHeight;
                if (conta.children && conta.children.length > 0) {
                    drawDreRows(conta.children, nivel + 1);
                }
            }
        }
        drawDreRows(dreData);
        doc.end();
    } catch (error) {
        console.error('Erro ao gerar DRE PDF:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

module.exports = { getDre, getDrePdf };