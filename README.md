# CCCD Text Recognition API

This project is a simple Node.js server that uses OCR (Optical Character Recognition) with `tesseract.js` to extract information from the front and back of a Vietnamese citizen identity card (CCCD).

## Features

- Detect and extract data from the front side of CCCD:
  - Name
  - ID Number
  - Date of Birth
- Detect and extract data from the back side of CCCD:
  - Issue Date
  - Place of Issue
  - Characteristics

---

## Prerequisites

Before starting, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 16+ recommended)
- [npm](https://www.npmjs.com/)

---

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/cccd-ocr-api.git
   cd cccd-ocr-api
