const express = require('express');
const tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 8080;

// //Nhận dữ liệu json
// app.use(express.json({ limit: '10mb' })); 

// Nhận dữ liệu application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.post('/api/detect/front', async (req, res) => {
    try {
        const { imageBase64 } = req.body;

        console.log(req.body, 'imageBase64');
        
        if (!imageBase64) {
            return res.status(200).json({ message: 'No image provided' });
        }

        // Convert base64 to Image
        const filePath = await saveBase64Image(imageBase64);

        // Detect image use ocr
        const { data: { text } } = await tesseract.recognize(filePath, 'eng');

        const parsedData = parseFrontSideData(text);

        // Xóa file tạm sau khi xử lý
        fs.unlinkSync(filePath);

        res.json({ success: true, data: parsedData });
    } catch (error) {
        console.error('Error during OCR:', error);
        res.status(200).json({ success: false, message: 'Failed to process the image' });
    }
});

app.post('/api/detect/back', async (req, res) => {
    try {
        const { imageBase64 } = req.body;

        if (!imageBase64) {
            return res.status(200).json({ message: 'No image provided' });
        }

        const filePath = await saveBase64Image(imageBase64);

        const { data: { text } } = await tesseract.recognize(filePath, 'eng');

        const parsedData = parseBackSideData(text);

        fs.unlinkSync(filePath);

        res.json({ success: true, data: parsedData });
    } catch (error) {
        console.error('Error during OCR:', error);
        res.status(200).json({ success: false, message: 'Failed to process the image' });
    }
});

async function saveBase64Image(base64String) {
    const matches = base64String.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);

    if (!matches || matches.length !== 3) {
        throw new Error('Invalid base64 format');
    }

    const imageType = matches[1];
    const imageData = matches[2];

    const fileName = `temp-${Date.now()}.${imageType}`;
    const filePath = path.join(__dirname, 'uploads', fileName);

    await fs.promises.writeFile(filePath, Buffer.from(imageData, 'base64'));

    return filePath;
}

function parseFrontSideData(text) {
    const nameMatch = text.match(/Họ tên:\s*(.*)/i);
    const idMatch = text.match(/Số:\s*(\d{12})/);
    const dobMatch = text.match(/Ngày sinh:\s*(\d{2}\/\d{2}\/\d{4})/);

    return {
        name: nameMatch ? nameMatch[1].trim() : null,
        id: idMatch ? idMatch[1] : null,
        dob: dobMatch ? dobMatch[1] : null
    };
}

function parseBackSideData(text) {
    const issueDateMatch = text.match(/Ngày cấp:\s*(\d{2}\/\d{2}\/\d{4})/);
    const placeOfIssueMatch = text.match(/Nơi cấp:\s*(.*)/i);
    const characteristicMatch = text.match(/Đặc điểm nhận dạng:\s*(.*)/i);

    return {
        issueDate: issueDateMatch ? issueDateMatch[1] : null,
        placeOfIssue: placeOfIssueMatch ? placeOfIssueMatch[1].trim() : null,
        characteristic: characteristicMatch ? characteristicMatch[1].trim() : null
    };
}

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
