const express = require('express');
const tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { exec } = require('child_process');
const app = express();
const port = 8080;

// //Nhận dữ liệu json
// app.use(express.json({ limit: '10mb' })); 

// Hàm lưu ảnh base64 vào file
async function saveBase64Image(base64String) {
    try {
        const uploadDir = path.join(__dirname, 'uploads');
        const fileName = `temp-${Date.now()}.png`;
        const filePath = path.join(uploadDir, fileName);

        // Tạo thư mục nếu chưa có
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Lưu ảnh từ base64 vào file
        await fs.promises.writeFile(filePath, Buffer.from(base64String, 'base64'));
        console.log(`Image saved to: ${filePath}`);

        return filePath;
    } catch (err) {
        throw new Error('Error saving base64 image: ' + err.message);
    }
}

// Hàm cắt ảnh thành 3 phần
async function splitImage(filePath) {
    try {
        const image = sharp(filePath);
        const metadata = await image.metadata();

        const width = metadata.width;
        const height = metadata.height;

        if (!width || !height) {
            throw new Error('Invalid image dimensions');
        }
        console.log(width, 'with\n', height, 'height');
        

        // Tạo các vùng cắt theo yêu cầu
        const regions = [
            { left: 0, top: 0, width: Math.floor(width / 3.2), height }, // 1/4 chiều ngang
            { left: Math.floor(width / 3.2), top: 0, width: width - Math.floor(width / 3.2), height:  Math.floor(height / 2) }, // 1/2 chiều dọc
            { left: Math.floor(width / 3.2), top:  Math.floor(height / 2), width: width - Math.floor(width / 3.2), height:  Math.floor(height / 2) } // Phần còn lại
        ];
    

        // Cắt và lưu từng vùng
        const croppedPaths = [];

        for (let i = 0; i < regions.length; i++) {
            const imageCopy = image.clone();
            const metadata = await imageCopy.metadata();

            const width = metadata.width;
            const height = metadata.height;
            console.log(width, '-', height);
            
            const outputFilePath = filePath.replace('.png', `-part${i + 1}.png`);
            await imageCopy.extract(regions[i]).toFile(outputFilePath);
            croppedPaths.push(outputFilePath);
        }

        
        return croppedPaths;
    } catch (error) {
        throw new Error('Error splitting image: ' + error.message);
    }
}



async function zoomImage(croppedPath, scaleFactor) {
    const zoomedImagePath = croppedPath.replace('.png', `-zoomed.png`);

    // Lấy thông tin metadata của ảnh để có width và height
    const metadata = await sharp(croppedPath).metadata();
    const width = metadata.width;
    const height = metadata.height;

    // Phóng to ảnh với tỉ lệ scaleFactor
    await sharp(croppedPath)
        .resize({ width: Math.floor(width * scaleFactor), height: Math.floor(height * scaleFactor) })
        .toFile(zoomedImagePath);

    return zoomedImagePath;
}



// Nhận dữ liệu application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.post('/api/detect/front', async (req, res) => {
    try {
        const { imageBase64 } = req.body;

        
        if (!imageBase64) {
            return res.status(200).json({ message: 'No image provided' });
        }

        // Convert base64 to Image
        const filePath = await saveBase64Image(imageBase64);

        // const text = await detectTextWithTesseract(filePath);

        // Cắt ảnh thành 3 phần
        const croppedPaths = await splitImage(filePath);

        // Nhận diện văn bản từ từng phần ảnh
        const ocrResults = [];

        for (const croppedPath of croppedPaths) {
            const zoomedPath = await zoomImage(croppedPath, 2); 

            const processedImagePath = await preprocessImage(zoomedPath);

            const { data: { text } } = await tesseract.recognize(processedImagePath, 'vie', {
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
              });


            ocrResults.push({ file: croppedPath, text: text });
        
            // Xóa file tạm sau khi OCR
            fs.unlinkSync(croppedPath);
        }
        

        
        // const { data: { text } } = await tesseract.recognize(filePath, 'vie');

        


        // Xóa file tạm sau khi xử lý
        fs.unlinkSync(filePath);

        const extractedData = extractInformation(ocrResults);

        res.json({ success: true, data: ocrResults, data2: extractedData });
    } catch (error) {
        console.error('Error during OCR:', error);
        res.status(200).json({ success: false, message: 'Failed to process the image' });
    }
});



// Hàm trích xuất thông tin từ văn bản OCR
function extractInformation(ocrResults) {
    const extractedData = {
        cccd: '',
        fullName: '',
        gender: '',
        nationality: '',
        hometown: '',
        permanentAddress: ''
    };

    // Duyệt qua kết quả OCR và tìm các thông tin cần thiết
    ocrResults.forEach(result => {
        const text = result.text;

        // Trích xuất số CCCD (sử dụng regex để tìm số CCCD 12 chữ số)
        const cccdMatch = text.match(/\d{12}/);
        console.log(cccdMatch, 'cccdMatch');
        
        if (cccdMatch) {
            extractedData.cccd = cccdMatch[0];
        }

        // Trích xuất họ và tên
        const nameMatch = text.match(/Họ và tên.*\n\s*([A-Za-zÀ-ÿ\s]+)\n/);
        console.log(nameMatch, 'nameMatch');
        if (nameMatch) {
            extractedData.fullName = nameMatch[1];
        }

        // Trích xuất giới tính
        const genderMatch = text.match(/Giới tính.*(Nam|Nữ)/);
        console.log(genderMatch, 'genderMatch');
        if (genderMatch) {
            extractedData.gender = genderMatch[1];
        }

        // Trích xuất quốc tịch
        const nationalityMatch = text.match(/Quốc tịch.*([A-Za-zÀ-ÿ ]+)/);
        console.log(nationalityMatch, 'nationalityMatch');
        if (nationalityMatch) {
            extractedData.nationality = nationalityMatch[1];
        }

        // Trích xuất quê quán
        const hometownMatch = text.match(/Quê quán.*([A-Za-zÀ-ÿ ]+)/);
        console.log(hometownMatch, 'hometownMatch');
        if (hometownMatch) {
            extractedData.hometown = hometownMatch[1];
        }

        // Trích xuất nơi thường trú
        const addressMatch = text.match(/Nơi thường trú.*([A-Za-zÀ-ÿ ]+)/);
        console.log(addressMatch, 'addressMatch');
        if (addressMatch) {
            extractedData.permanentAddress = addressMatch[1];
        }
    });

    return extractedData;
}


// Hàm nhận dạng văn bản với Tesseract
async function detectTextWithTesseract(imagePath) {
    try {
        // Tiền xử lý ảnh (tăng độ tương phản, chuyển sang đen trắng)
        const processedImagePath = await preprocessImage(imagePath);

        // Sử dụng Tesseract để nhận dạng văn bản từ ảnh đã xử lý
        const { data: { text } } = await tesseract.recognize(
            processedImagePath, 
            'vie',               // Sử dụng cả tiếng Anh và tiếng Việt
            { psm: 6 }               // Cấu hình Page Segmentation Mode (PSM)
        );

        // Xóa ảnh đã xử lý sau khi nhận dạng
        fs.unlinkSync(processedImagePath);

        return text;
    } catch (err) {
        console.error('Tesseract Error:', err);
        throw new Error('Error during text detection');
    }
}

// Hàm lưu ảnh base64 vào file
async function saveBase64Image(base64String) {
    try {
        const uploadDir = path.join(__dirname, 'uploads');
        const fileName = `temp-${Date.now()}.png`;
        const filePath = path.join(uploadDir, fileName);

        // Tạo thư mục nếu chưa có
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Lưu ảnh từ base64 vào file
        await fs.promises.writeFile(filePath, Buffer.from(base64String, 'base64'));
        console.log(`Image saved to: ${filePath}`);

        return filePath;
    } catch (err) {
        throw new Error('Error saving base64 image: ' + err.message);
    }
}



async function preprocessImage(filePath) {
    try {
        const outputFilePath = path.join(__dirname, 'uploads', `processed-${Date.now()}.png`);

        // Xử lý ảnh: chuyển sang thang xám và tăng độ tương phản
        await sharp(filePath)
            .grayscale()               // Chuyển ảnh sang thang xám
            .normalize()               // Tăng độ tương phản
            .toFile(outputFilePath);   // Lưu ảnh xử lý ra file mới

        return outputFilePath; // Trả về đường dẫn ảnh đã xử lý

    } catch (err) {
        console.error('Error preprocessing image:', err);
        throw new Error('Error preprocessing image: ' + err.message);
    }
}


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
