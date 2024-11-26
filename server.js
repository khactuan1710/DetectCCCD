const express = require('express');
const app = express();
const port = 3000;

// Middleware để parse JSON
app.use(express.json());

// Route cơ bản
app.get('/', (req, res) => {
    res.send('Hello, Node.js Server!');
});

// API POST để nhận dữ liệu từ client
app.post('/api/data', (req, res) => {
    console.log(req.body); // Log dữ liệu từ client
    res.json({ message: 'Data received!', data: req.body });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
