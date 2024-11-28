import sys
import easyocr
import json

def run_easyocr(image_path):
    print("Python executable path:", sys.executable)
    print("Python version:", sys.version)
    reader = easyocr.Reader(['vi'])  # 'vi' là mã ngôn ngữ tiếng Việt
    results = reader.readtext(image_path, detail=0)  # detail=0 chỉ lấy text, không lấy tọa độ
    return results

if __name__ == "__main__":
    image_path = sys.argv[1]  # Đường dẫn tới tệp ảnh truyền vào từ Node.js
    try:
        text_results = run_easyocr(image_path)
        print(json.dumps({"success": True, "data": text_results}))
    except Exception as e:
        print(json.dumps({"success": False, "message": str(e)}))
