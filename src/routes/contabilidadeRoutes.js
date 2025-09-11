const express = require('express');
const router = express.Router();
const { getPlanoContas, createLancamento, getPartidas } = require('../controllers/lancamentoController');

router.get('/plano-contas', getPlanoContas);
router.post('/lancamentos', createLancamento);
router.get('/partidas', getPartidas);

module.exports = router;
