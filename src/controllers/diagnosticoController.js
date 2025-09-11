const db = require('../database/db');

// Controller simples para buscar TODAS as partidas, sem filtro de data
const getAllPartidas = async (req, res) => {
    try {
        const query = `
            SELECT 
                ll.data_lancamento,
                p.valor,
                p.tipo_partida,
                pc.codigo_conta,
                pc.nome_conta
            FROM sistema_contabil.partidas_dobradas p
            JOIN sistema_contabil.lotes_lancamentos ll ON p.id_lote = ll.id
            JOIN sistema_contabil.plano_contas pc ON p.id_conta_contabil = pc.id
            ORDER BY ll.data_lancamento DESC;
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Erro no diagnóstico:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao rodar diagnóstico.' });
    }
};

module.exports = { getAllPartidas };