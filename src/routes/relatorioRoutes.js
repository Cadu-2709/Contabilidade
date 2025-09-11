const express = require('express');
const router = express.Router();
const { getDre, getDrePdf } = require('../controllers/relatorioController');

router.get('/dre', getDre);
router.get('/dre/pdf', getDrePdf);

module.exports = router;