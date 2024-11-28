import numpy as np
from PIL import Image
from io import BytesIO
import base64
import re
import easyocr
from flask import Flask, request, jsonify

# Khởi tạo EasyOCR reader
reader = easyocr.Reader(['vi'])  # Cung cấp ngôn ngữ tiếng Anh và Tiếng Việt

app = Flask(__name__)

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
    
    return result, text  # Trả về cả kết quả OCR và văn bản

# Hàm cắt ảnh từ vị trí chữ "CỘNG HÒA XÃ HỘI"
def crop_front_image(image, result):
    for item in result:
        text = item[1]
        if "CỘNG HÒA" in text:
            # Lấy bounding box của chữ "CỘNG HÒA XÃ HỘI"
            box = item[0]  # box là một list các điểm góc của bounding box
            
            # Tìm x_min (vị trí bên trái của bounding box)
            min_x = min([point[0] for point in box])

            # Lấy chiều cao và chiều rộng của ảnh
            image_width, image_height = image.size
            
            # Cắt ảnh từ min_x trở đi (tức là phần bên phải của ảnh)
            cropped_image = image.crop((min_x, 0, image_width, image_height))
            return cropped_image
    
    # Nếu không tìm thấy "CỘNG HÒA XÃ HỘI", trả lại ảnh gốc
    return image

def extract_information(text):
    # Cập nhật các biểu thức chính quy
    cccd_pattern = r"(\d{9,12})"
    name_pattern = r"Họ và tên[^\:]*:?\s*([A-Za-zÀ-ỹ\s]+(?: [A-Za-zÀ-ỹ\s]+)*)"
    dob_pattern = r"Ngày sinh[^\:]*:?\s*(\d{2}/\d{2}/\d{4})"
    gender_pattern = r"Giới tính[^\:]*:?\s*(Nam|Nữ|Male|Female)"
    nationality_pattern = r"Quốc tịch[^\:]*:?\s*([A-Za-zÀ-ỹ\s]+)"
    origin_pattern = r"Quê quán[^\:]*:?\s*([A-Za-zÀ-ỹ\s]+(?:, [A-Za-zÀ-ỹ\s]+)*)"
    residence_pattern = r"Nơi thường trú[^\:]*:?\s*([A-Za-zÀ-ỹ\s,]+)"

    cccd = re.search(cccd_pattern, text)
    name = re.search(name_pattern, text)
    dob = re.search(dob_pattern, text)
    gender = re.search(gender_pattern, text)
    nationality = re.search(nationality_pattern, text)
    origin = re.search(origin_pattern, text)
    residence = re.search(residence_pattern, text)

    result = {
        "cccd": cccd.group(1) if cccd else None,
        "name": name.group(1) if name else None,
        "dob": dob.group(1) if dob else None,
        "gender": gender.group(1) if gender else None,
        "nationality": nationality.group(1) if nationality else None,
        "origin": origin.group(1) if origin else None,
        "residence": residence.group(1) if residence else None
    }

    return result



@app.route('/detect-front', methods=['POST'])
def detect_front():
    data = request.json
    base64_image = data.get('front')  # Nhận ảnh mặt trước dưới dạng base64
    if not base64_image:
        return jsonify({'error': 'No image provided'}), 400

    image = base64_to_image(base64_image)
    
    # Trước khi thực hiện OCR, cắt ảnh từ chữ "CỘNG HÒA XÃ HỘI" trở đi
    result, text = ocr_from_image(image)
    cropped_image = crop_front_image(image, result)
    
    # Thực hiện OCR trên phần ảnh đã cắt
    cropped_result, cropped_text = ocr_from_image(cropped_image)
    
    # print("OCR Text from Cropped Image:", cropped_text)
    extracted_info = extract_information(cropped_text)
    # Trả về thông tin OCR từ ảnh đã cắt
    return jsonify({
        'extracted_info': extracted_info,
        'cropped_text': cropped_text,
    })

# Hàm chuyển ảnh cắt thành base64 để trả về
def base64_image_to_response(image):
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

if __name__ == '__main__':
    app.run(debug=True)
