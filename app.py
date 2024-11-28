from flask import Flask, request, jsonify
import easyocr
from PIL import Image
import base64
from io import BytesIO
import numpy as np  # Import numpy
import re

# Khởi tạo EasyOCR reader
reader = easyocr.Reader(['vi'])  # Cung cấp ngôn ngữ tiếng Anh và Tiếng Việt

app = Flask(__name__)


# Hàm trích xuất thông tin từ văn bản OCR
def extract_information(text):
    data = {}

    # Trích xuất số CCCD
    cccd_match = re.search(r'\bSô\s*\/\s*No\s*[:\-]?\s*(\d+)\b', text)
    if cccd_match:
        data['cccd'] = cccd_match.group(1)

    # Trích xuất họ và tên (bao gồm dấu cách)
    name_match = re.search(r'Họ và tên\s*\/\s*Full name[;]?\s*([A-Za-z\sÀ-ỹ]+)', text)
    if name_match:
        data['name'] = name_match.group(1).strip()

    # Trích xuất ngày sinh
    dob_match = re.search(r'Ngày sinh\s*Date of birth\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})', text)
    if dob_match:
        data['dob'] = dob_match.group(1)

    # Trích xuất giới tính
    sex_match = re.search(r'Giới tinh\s*Sex\s*[:\-]?\s*(Nam|Nữ)', text)
    if sex_match:
        data['sex'] = sex_match.group(1)

    # Trích xuất quốc tịch
    nationality_match = re.search(r'Quôc tịch\s*\/\s*Nationality\s*[:\-]?\s*([A-Za-z\s]+)', text)
    if nationality_match:
        data['nationality'] = nationality_match.group(1).strip()

    # Trích xuất quê quán
    origin_match = re.search(r'Quê quản\s*Place of origin\s*[:\-]?\s*([A-Za-z\s;]+)', text)
    if origin_match:
        data['place_of_origin'] = origin_match.group(1).strip()

    # Trích xuất nơi thường trú
    residence_match = re.search(r'Nơi thường trú\s*\/\s*Place of residence\s*[:\-]?\s*([A-Za-z\s;]+)', text)
    if residence_match:
        data['place_of_residence'] = residence_match.group(1).strip()

    return data

# Hàm chuyển base64 thành ảnh
def base64_to_image(base64_string):
    img_data = base64.b64decode(base64_string)
    return Image.open(BytesIO(img_data))

# Hàm nhận diện văn bản từ ảnh sử dụng EasyOCR
def ocr_from_image(image):
    # Chuyển đổi ảnh thành định dạng mà EasyOCR có thể xử lý (từ PIL Image sang numpy array)
    image = image.convert('RGB')  # Chuyển sang dạng RGB nếu ảnh là dạng khác
    image_np = np.array(image)
    
    # Sử dụng EasyOCR để nhận diện văn bản
    result = reader.readtext(image_np)
    
    # Ghép các kết quả nhận diện thành một chuỗi văn bản
    text = " ".join([item[1] for item in result])
    return text

@app.route('/detect-front', methods=['POST'])
def detect_front():
    data = request.json
    base64_image = data.get('front')  # Nhận ảnh mặt trước dưới dạng base64
    if not base64_image:
        return jsonify({'error': 'No image provided'}), 400

    image = base64_to_image(base64_image)
    text = ocr_from_image(image)

    print(text)
    # Trích xuất thông tin từ văn bản OCR
    extracted_data = extract_information(text)

    return jsonify(extracted_data)

@app.route('/detect-back', methods=['POST'])
def detect_back():
    data = request.json
    base64_image = data.get('back')  # Nhận ảnh mặt sau dưới dạng base64
    if not base64_image:
        return jsonify({'error': 'No image provided'}), 400

    image = base64_to_image(base64_image)
    text = ocr_from_image(image)

    return jsonify({'text': text})

if __name__ == '__main__':
    app.run(debug=True)
