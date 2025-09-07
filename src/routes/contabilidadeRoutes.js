const express = require('express');
const router = express.Router();
const { getPlanoContas, createLancamento, getPartidas } = require('../controllers/lancamentoController');

// Rota para buscar o plano de contas completo
router.get('/plano-contas', getPlanoContas);

// Rota para criar um novo lançamento
router.post('/lancamentos', createLancamento);

// NOVO: Rota para buscar as partidas
router.get('/partidas', getPartidas);

module.exports = router;
