// backend/user-service/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Basic route
app.get('/health', (req, res) => {
    res.status(200).json({ message: 'User Service is running!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`User Service listening on port ${PORT}`);
});