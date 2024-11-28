import base64
from PIL import Image
import numpy as np
from io import BytesIO
from flask import Flask, request, jsonify
import easyocr
import matplotlib.pyplot as plt

# Khởi tạo EasyOCR Reader
reader = easyocr.Reader(['en', 'vi'])

app = Flask(__name__)

# Hàm chuyển đổi base64 thành ảnh
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

# Hàm điều chỉnh kích thước ảnh (ví dụ: chuyển ảnh về kích thước cố định)
def resize_image(image, target_width, target_height):
    return image.resize((target_width, target_height), Image.Resampling.LANCZOS)

# Hàm cắt ảnh từ các vùng thông tin cụ thể
def crop_image_to_regions(image, regions):
    cropped_images = {}
    
    for label, (x1, y1, x2, y2) in regions.items():
        # Cắt ảnh theo vùng và lưu vào dictionary với key là label
        cropped_images[label] = image.crop((x1, y1, x2, y2))
    
    return cropped_images

# Hàm trích xuất thông tin từ văn bản OCR (giả sử bạn đã có hàm này)
def extract_information(text):
    # Trích xuất thông tin từ văn bản (ví dụ: tên, ngày sinh, etc.)
    # Đây là một hàm giả, bạn có thể thay đổi tùy theo yêu cầu
    return {
        'name': text.split()[0] if len(text.split()) > 0 else '',
        'dob': text.split()[1] if len(text.split()) > 1 else '',
        # Cập nhật các trường khác tương tự
    }

@app.route('/detect-front', methods=['POST'])
def detect_front():
    data = request.json
    base64_image = data.get('front')  # Nhận ảnh mặt trước dưới dạng base64
    if not base64_image:
        return jsonify({'error': 'No image provided'}), 400

    image = base64_to_image(base64_image)
    
    # Điều chỉnh kích thước ảnh sao cho phù hợp với các vùng cắt
    target_width = 1000  # Ví dụ, chiều rộng cần điều chỉnh
    target_height = 1500  # Chiều cao cần điều chỉnh
    resized_image = resize_image(image, target_width, target_height)
    
    # Định nghĩa các vùng bạn muốn cắt (Họ và tên, Ngày sinh, Giới tính, ...)
    # Các vùng này sẽ được xác định dựa trên kích thước ảnh đã điều chỉnh
    regions = {
        'ho_ten': (50, 100, 300, 150),  # Xác định tọa độ (x1, y1, x2, y2) cho từng vùng
        'ngay_sinh': (50, 150, 300, 200),
        'gioi_tinh': (50, 200, 300, 250),
        'quoc_tich': (50, 250, 300, 300),
        'que_quan': (50, 300, 300, 350),
        'noi_thuong_tru': (50, 350, 300, 400)
    }
    
    # Cắt ảnh thành các vùng con dựa trên kích thước mới
    cropped_images = crop_image_to_regions(resized_image, regions)
    
    extracted_info = {}
    
    # Thực hiện OCR cho từng vùng đã cắt và trích xuất thông tin
    for label, cropped_image in cropped_images.items():
        cropped_image = cropped_images[label]
        plt.imshow(cropped_image)
        plt.axis('off')  # Tắt hiển thị trục
        plt.show()
        result, text = ocr_from_image(cropped_image)
        extracted_info[label] = {
            'ocr_result': result,
            'text': text
        }
    
    # Trả về thông tin OCR từ các vùng cắt
    return jsonify(extracted_info)

# Hàm chuyển ảnh cắt thành base64 để trả về (nếu cần)
def base64_image_to_response(image):
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

if __name__ == '__main__':
    app.run(debug=True)
