const express = require('express');
const router = express.Router();
const { getDre, getDrePdf, getBalancete } = require('../controllers/relatorioController');

router.get('/dre', getDre);
router.get('/dre/pdf', getDrePdf);
router.get('/balancete', getBalancete);

module.exports = router;