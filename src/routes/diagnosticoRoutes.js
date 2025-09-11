const express = require('express');
const router = express.Router();
const { getAllPartidas } = require('../controllers/diagnosticoController');

router.get('/lancamentos', getAllPartidas);

module.exports = router;