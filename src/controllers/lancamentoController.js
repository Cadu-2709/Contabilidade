const db = require('../database/db');

// Controller para buscar TODAS as contas.
const getPlanoContas = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, id_conta_pai, codigo_conta, nome_conta, tipo_conta FROM sistema_contabil.plano_contas ORDER BY codigo_conta'
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar plano de contas:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// CORREÇÃO: A função getPartidas foi movida para fora da createLancamento.
// Controller para buscar as últimas partidas lançadas
const getPartidas = async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id,
                p.valor,
                p.tipo_partida,
                pc.codigo_conta,
                pc.nome_conta,
                ll.data_lancamento
            FROM sistema_contabil.partidas_dobradas AS p
            JOIN sistema_contabil.plano_contas AS pc ON p.id_conta_contabil = pc.id
            JOIN sistema_contabil.lotes_lancamentos AS ll ON p.id_lote = ll.id
            ORDER BY p.id DESC;
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar partidas:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

// Controller para criar um novo lançamento contábil.
const createLancamento = async (req, res) => {
  const { data_lancamento, historico, partidas } = req.body;

  // Validação básica dos dados recebidos
  if (!data_lancamento || !historico || !partidas || partidas.length < 2) {
    return res.status(400).json({ message: 'Dados inválidos.' });
  }

  // Validação: A soma dos débitos deve ser igual à soma dos créditos.
  const totalDebitos = partidas
    .filter((p) => p.tipo === 'D')
    .reduce((acc, p) => acc + parseFloat(p.valor), 0);

  const totalCreditos = partidas
    .filter((p) => p.tipo === 'C')
    .reduce((acc, p) => acc + parseFloat(p.valor), 0);
  
  // Usamos uma pequena tolerância para comparações de ponto flutuante
  if (Math.abs(totalDebitos - totalCreditos) > 0.001) {
    return res.status(400).json({ message: 'A soma dos débitos e créditos não bate.' });
  }

  const client = await db.pool.connect(); // Pega uma conexão do pool

  try {
    // Inicia a transação
    await client.query('BEGIN');

    // 1. Insere o lote (cabeçalho) e obtém o ID gerado
    const loteQuery = 'INSERT INTO sistema_contabil.lotes_lancamentos (data_lancamento, historico) VALUES ($1, $2) RETURNING id';
    const loteResult = await client.query(loteQuery, [data_lancamento, historico]);
    const loteId = loteResult.rows[0].id;

    // 2. Insere cada partida (débito/crédito) vinculada ao lote
    const partidaQuery = 'INSERT INTO sistema_contabil.partidas_dobradas (id_lote, id_conta_contabil, tipo_partida, valor) VALUES ($1, $2, $3, $4)';
    
    for (const partida of partidas) {
      await client.query(partidaQuery, [loteId, partida.id_conta, partida.tipo, partida.valor]);
    }

    // Se tudo deu certo, efetiva a transação
    await client.query('COMMIT');
    res.status(201).json({ message: 'Lançamento criado com sucesso!', loteId });

  } catch (error) {
    // Se qualquer erro ocorreu, desfaz a transação
    await client.query('ROLLBACK');
    console.error('Erro ao criar lançamento:', error);
    res.status(500).json({ message: 'Erro ao salvar lançamento no banco de dados.' });

  } finally {
    // Libera a conexão de volta para o pool, independentemente do resultado
    client.release();
  }
};


module.exports = {
  getPlanoContas,
  createLancamento,
  getPartidas,
};