import { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import api from "../services/api";

function BillScanner({ fetchTransactions }) {
  const [images, setImages] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocrText, setOcrText] = useState("");
  const [results, setResults] = useState([]);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // =========================================================
  // ADD UPLOADED IMAGES
  // =========================================================

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) {
      return;
    }

    const validFiles = files.filter((file) =>
      file.type.startsWith("image/")
    );

    if (validFiles.length === 0) {
      alert("Please select image files only.");
      return;
    }

    const newImages = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newImages]);

    setResults([]);
    setOcrText("");
    setProgress(0);

    e.target.value = "";
  };

  // =========================================================
  // OPEN CAMERA
  // =========================================================

  const openCamera = async () => {
    setCameraError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Camera access is not supported by this browser."
        );
        return;
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment",
            },
            width: {
              ideal: 1280,
            },
            height: {
              ideal: 720,
            },
          },
          audio: false,
        });

      streamRef.current = stream;

      setCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (error) {
      console.error("Camera error:", error);

      if (error.name === "NotAllowedError") {
        setCameraError(
          "Camera permission was denied. Please allow camera access."
        );
      } else if (error.name === "NotFoundError") {
        setCameraError(
          "No camera was found on this device."
        );
      } else {
        setCameraError(
          "Unable to access the camera."
        );
      }
    }
  };

  // =========================================================
  // CLOSE CAMERA
  // =========================================================

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
  };

  // =========================================================
  // CAPTURE PHOTO
  // =========================================================

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      alert(
        "Camera is not ready yet. Please wait."
      );
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          alert("Could not capture photo.");
          return;
        }

        const imageUrl =
          URL.createObjectURL(blob);

        const newImage = {
          id: `${Date.now()}-${Math.random()}`,
          file: blob,
          url: imageUrl,
        };

        // Add instead of replacing existing images
        setImages((prev) => [
          ...prev,
          newImage,
        ]);

        setResults([]);
        setOcrText("");
        setProgress(0);

        closeCamera();
      },
      "image/jpeg",
      0.95
    );
  };

  // =========================================================
  // REMOVE IMAGE
  // =========================================================

  const removeImage = (id) => {
    setImages((prev) => {
      const item = prev.find(
        (image) => image.id === id
      );

      if (item) {
        URL.revokeObjectURL(item.url);
      }

      return prev.filter(
        (image) => image.id !== id
      );
    });

    setResults([]);
  };

  // =========================================================
  // CLEAR ALL
  // =========================================================

  const clearImages = () => {
    images.forEach((image) => {
      URL.revokeObjectURL(image.url);
    });

    setImages([]);
    setResults([]);
    setOcrText("");
    setProgress(0);
  };

  // =========================================================
  // CAMERA CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  // =========================================================
  // EXTRACT AMOUNT
  // =========================================================

  const extractAmount = (text) => {
    const cleanedText = text
      .replace(/,/g, "")
      .replace(/\r/g, "");

    // ------------------------------------------
    // Amount (INR)
    // ------------------------------------------

    const incomeAmountPatterns = [
      /amount\s*\(\s*inr\s*\)\s*[:\-]?\s*(\d+(?:\.\d{1,2})?)/i,

      /amount\s*\(\s*rs\.?\s*\)\s*[:\-]?\s*(\d+(?:\.\d{1,2})?)/i,

      /amount\s*\(\s*₹\s*\)\s*[:\-]?\s*(\d+(?:\.\d{1,2})?)/i,

      /amount\s*(?:inr|rs\.?|₹)\s*[:\-]?\s*(\d+(?:\.\d{1,2})?)/i,
    ];

    for (const pattern of incomeAmountPatterns) {
      const match = cleanedText.match(pattern);

      if (match) {
        const amount = Number(match[1]);

        if (amount > 0) {
          return amount;
        }
      }
    }

    // ------------------------------------------
    // GRAND TOTAL
    // ------------------------------------------

    const grandTotalPatterns = [
      /grand\s*total[\s:.\-₹rsinr]*?(\d+(?:\.\d{1,2})?)/i,

      /grand[\s\-]*total[\s\S]{0,100}?(\d+(?:\.\d{1,2})?)/i,

      /grand\s*total[\s\S]{0,150}?(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)/i,
    ];

    for (const pattern of grandTotalPatterns) {
      const match = cleanedText.match(pattern);

      if (match) {
        const amount = Number(match[1]);

        if (amount > 0) {
          return amount;
        }
      }
    }

    // ------------------------------------------
    // AMOUNT PAID
    // ------------------------------------------

    const paidPatterns = [
      /amount\s*paid[\s:.\-₹rsinr]*?(\d+(?:\.\d{1,2})?)/i,

      /amount\s*paid[\s\S]{0,80}?(\d+(?:\.\d{1,2})?)/i,
    ];

    for (const pattern of paidPatterns) {
      const match = cleanedText.match(pattern);

      if (match) {
        const amount = Number(match[1]);

        if (amount > 0) {
          return amount;
        }
      }
    }

    // ------------------------------------------
    // TOTAL
    // ------------------------------------------

    const totalPatterns = [
      /(?:^|\n)\s*total\s*[:.\-₹rsinr]*?(\d+(?:\.\d{1,2})?)/im,

      /total[\s:.\-₹rsinr]*?(\d+(?:\.\d{1,2})?)/i,

      /total[\s\S]{0,80}?(\d+(?:\.\d{1,2})?)/i,
    ];

    for (const pattern of totalPatterns) {
      const match = cleanedText.match(pattern);

      if (match) {
        const amount = Number(match[1]);

        if (amount > 0) {
          return amount;
        }
      }
    }

    // ------------------------------------------
    // SUBTOTAL
    // ------------------------------------------

    const subtotalPatterns = [
      /subtotal[\s:.\-₹rsinr]*?(\d+(?:\.\d{1,2})?)/i,

      /sub\s*total[\s:.\-₹rsinr]*?(\d+(?:\.\d{1,2})?)/i,
    ];

    for (const pattern of subtotalPatterns) {
      const match = cleanedText.match(pattern);

      if (match) {
        const amount = Number(match[1]);

        if (amount > 0) {
          return amount;
        }
      }
    }

    // ------------------------------------------
    // RUPEE SYMBOL
    // ------------------------------------------

    const rupeeMatches = [
      ...cleanedText.matchAll(
        /₹\s*(\d+(?:\.\d{1,2})?)/g
      ),
    ];

    if (rupeeMatches.length > 0) {
      const amounts = rupeeMatches
        .map((match) => Number(match[1]))
        .filter((amount) => amount > 0);

      if (amounts.length > 0) {
        return Math.max(...amounts);
      }
    }

    // ------------------------------------------
    // INR / RS
    // ------------------------------------------

    const currencyMatches = [
      ...cleanedText.matchAll(
        /(?:rs\.?|inr)\s*(\d+(?:\.\d{1,2})?)/gi
      ),
    ];

    if (currencyMatches.length > 0) {
      const amounts = currencyMatches
        .map((match) => Number(match[1]))
        .filter((amount) => amount > 0);

      if (amounts.length > 0) {
        return Math.max(...amounts);
      }
    }

    // ------------------------------------------
    // DECIMAL FALLBACK
    // ------------------------------------------

    const decimalMatches = [
      ...cleanedText.matchAll(
        /\b(\d+\.\d{2})\b/g
      ),
    ];

    if (decimalMatches.length > 0) {
      const amounts = decimalMatches
        .map((match) => Number(match[1]))
        .filter((amount) => amount > 0);

      if (amounts.length > 0) {
        return Math.max(...amounts);
      }
    }

    return null;
  };

  // =========================================================
  // DETECT TYPE
  // =========================================================

  const detectType = (text) => {
    const lower = text.toLowerCase();

    const incomeWords = [
      "salary",
      "salary credited",
      "salary credit",
      "monthly salary",
      "payroll",
      "pay slip",
      "payslip",
      "net pay",
      "net salary",
      "gross salary",

      "bonus",
      "performance bonus",
      "annual bonus",
      "incentive",
      "commission",

      "freelance",
      "freelancer",
      "freelance payment",
      "freelance income",
      "project payment",
      "service payment",
      "professional fee",

      "business income",
      "business payment",
      "sales income",
      "sales receipt",
      "revenue",
      "profit",
      "customer payment",

      "rent received",
      "rental income",
      "rent income",
      "house rent received",
      "property rent",

      "refund",
      "refund received",
      "amount refunded",
      "cashback",
      "cash back",
      "money back",

      "investment return",
      "investment income",
      "dividend",
      "interest received",
      "interest income",
      "mutual fund return",
      "stock return",

      "scholarship",
      "scholarship received",
      "education allowance",

      "allowance",
      "monthly allowance",
      "pocket money",
      "stipend",
      "stipend received",

      "credit",
      "credited",
      "credit advice",
      "amount credited",
      "deposit",
      "deposit received",
      "payment received",
      "money received",
      "amount received",
      "funds received",
      "transfer received",

      "income",
      "earnings",
      "earning",
      "paid to me",
      "received from",
    ];

    const expenseWords = [
      "restaurant",
      "food",
      "shopping",
      "grocery",
      "supermarket",
      "purchase",
      "bill",
      "invoice",
      "receipt",
      "cafe",
      "hotel",
      "transport",
      "fuel",
      "petrol",
      "pharmacy",
      "medicine",
      "medical",
      "gst",
      "cgst",
      "sgst",
      "tax",
      "amount payable",
      "amount paid",
      "subtotal",
      "grand total",
      "shopping mall",
      "electricity bill",
      "water bill",
      "gas bill",
      "mobile bill",
      "internet bill",
      "school fee",
      "college fee",
    ];

    const hasIncome = incomeWords.some(
      (word) => lower.includes(word)
    );

    const hasExpense = expenseWords.some(
      (word) => lower.includes(word)
    );

    const strongIncomeWords = [
      "salary",
      "salary credited",
      "salary credit",
      "freelance payment",
      "freelance income",
      "rent received",
      "rental income",
      "refund received",
      "scholarship received",
      "stipend received",
      "payment received",
      "amount received",
      "money received",
      "amount credited",
      "credit advice",
      "credited",
      "dividend",
      "interest received",
      "business income",
      "sales income",
      "bonus",
      "commission",
    ];

    const strongIncome =
      strongIncomeWords.some(
        (word) => lower.includes(word)
      );

    if (strongIncome) {
      return "income";
    }

    if (hasIncome && !hasExpense) {
      return "income";
    }

    return "expense";
  };

  // =========================================================
  // DETECT CATEGORY
  // =========================================================

  const detectCategory = (text) => {
    const lower = text.toLowerCase();

    // Income categories

    if (
      lower.includes("salary") ||
      lower.includes("payroll") ||
      lower.includes("payslip") ||
      lower.includes("pay slip")
    ) {
      return "Salary";
    }

    if (
      lower.includes("freelance") ||
      lower.includes("freelancer") ||
      lower.includes("project payment") ||
      lower.includes("professional fee") ||
      lower.includes("service payment")
    ) {
      return "Freelance";
    }

    if (
      lower.includes("business income") ||
      lower.includes("business payment") ||
      lower.includes("sales income") ||
      lower.includes("sales receipt") ||
      lower.includes("revenue") ||
      lower.includes("customer payment")
    ) {
      return "Business";
    }

    if (
      lower.includes("rent received") ||
      lower.includes("rental income") ||
      lower.includes("rent income") ||
      lower.includes("house rent received") ||
      lower.includes("property rent")
    ) {
      return "Rent";
    }

    if (
      lower.includes("bonus") ||
      lower.includes("incentive") ||
      lower.includes("commission")
    ) {
      return "Bonus";
    }

    if (
      lower.includes("refund") ||
      lower.includes("cashback") ||
      lower.includes("cash back")
    ) {
      return "Refund";
    }

    if (
      lower.includes("investment") ||
      lower.includes("dividend") ||
      lower.includes("interest received") ||
      lower.includes("mutual fund") ||
      lower.includes("stock return")
    ) {
      return "Investment";
    }

    if (
      lower.includes("scholarship") ||
      lower.includes("education allowance")
    ) {
      return "Scholarship";
    }

    if (
      lower.includes("allowance") ||
      lower.includes("pocket money") ||
      lower.includes("stipend")
    ) {
      return "Allowance";
    }

    // Expense categories

    if (
      lower.includes("restaurant") ||
      lower.includes("food") ||
      lower.includes("cafe") ||
      lower.includes("hotel")
    ) {
      return "Food";
    }

    if (
      lower.includes("shopping") ||
      lower.includes("mall") ||
      lower.includes("clothing") ||
      lower.includes("purchase") ||
      lower.includes("store")
    ) {
      return "Shopping";
    }

    if (
      lower.includes("grocery") ||
      lower.includes("supermarket") ||
      lower.includes("dmart")
    ) {
      return "Groceries";
    }

    if (
      lower.includes("petrol") ||
      lower.includes("fuel") ||
      lower.includes("transport")
    ) {
      return "Transport";
    }

    if (
      lower.includes("pharmacy") ||
      lower.includes("medical") ||
      lower.includes("medicine")
    ) {
      return "Medical";
    }

    return "Other";
  };

  // =========================================================
  // EXTRACT TITLE
  // =========================================================

  const extractTitle = (text, category) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 2);

    // Income titles

    if (category === "Salary") {
      return "Salary";
    }

    if (category === "Freelance") {
      return "Freelance Payment";
    }

    if (category === "Rent") {
      return "Rent Received";
    }

    if (category === "Bonus") {
      return "Bonus";
    }

    if (category === "Refund") {
      return "Refund";
    }

    if (category === "Investment") {
      return "Investment Income";
    }

    if (category === "Scholarship") {
      return "Scholarship";
    }

    if (category === "Allowance") {
      return "Allowance";
    }

    if (category === "Business") {
      return "Business Income";
    }

    // Expense title

    for (const line of lines.slice(0, 15)) {
      const lower = line.toLowerCase();

      if (
        lower.includes("restaurant") ||
        lower.includes("cafe") ||
        lower.includes("mall") ||
        lower.includes("store") ||
        lower.includes("shop") ||
        lower.includes("supermarket")
      ) {
        let title = line;

        title = title.replace(
          /^[^a-zA-Z]*/,
          ""
        );

        title = title.replace(
          /[^a-zA-Z0-9&.'\s-]+$/g,
          ""
        );

        title = title.replace(
          /\s+\d+["'=]+\s*$/g,
          ""
        );

        title = title
          .replace(/\s+/g, " ")
          .trim();

        title = title.replace(
          /^a\s+/i,
          ""
        );

        if (title.length > 2) {
          return title.substring(0, 60);
        }
      }
    }

    return `${category} Transaction`;
  };

  // =========================================================
  // EXTRACT DATE
  // =========================================================

  const extractDate = (text) => {
    const patterns = [
      /date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,

      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);

      if (match) {
        const parts =
          match[1].split(/[\/\-]/);

        let day;
        let month;
        let year;

        if (parts[0].length === 4) {
          year = Number(parts[0]);
          month = Number(parts[1]);
          day = Number(parts[2]);
        } else {
          day = Number(parts[0]);
          month = Number(parts[1]);
          year = Number(parts[2]);

          if (year < 100) {
            year += 2000;
          }
        }

        const date = new Date(
          year,
          month - 1,
          day
        );

        if (
          date.getFullYear() === year &&
          date.getMonth() === month - 1 &&
          date.getDate() === day
        ) {
          return `${year}-${String(
            month
          ).padStart(2, "0")}-${String(
            day
          ).padStart(2, "0")}`;
        }
      }
    }

    const today = new Date();

    return `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
  };

  // =========================================================
  // CHECK TRANSACTION DOCUMENT
  // =========================================================

  const isBill = (text) => {
    const lower = text.toLowerCase();

    const keywords = [
      "total",
      "grand total",
      "subtotal",
      "amount",
      "bill",
      "invoice",
      "receipt",
      "gst",
      "cgst",
      "sgst",
      "tax",
      "restaurant",
      "shopping",
      "store",
      "supermarket",
      "grocery",
      "cafe",
      "pharmacy",
      "purchase",

      "credit advice",
      "credit",
      "credited",
      "salary",
      "salary credit",
      "amount credited",
      "transaction details",
      "type of transaction",
      "account name",
      "bank",
      "deposit",
      "received",
      "income",
      "bonus",
      "refund",
      "freelance",
      "rent received",
      "rental income",
      "scholarship",
      "stipend",
      "allowance",
      "dividend",
      "interest received",
      "business income",
      "payment received",
    ];

    return keywords.some(
      (word) => lower.includes(word)
    );
  };

  // =========================================================
  // IMAGE ENHANCEMENT
  // =========================================================

  const createProcessedImage = (
    source,
    crop = null
  ) => {
    return new Promise(
      (resolve, reject) => {
        const img = new Image();

        img.onload = () => {
          const scale = 2;

          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth =
            img.width;
          let sourceHeight =
            img.height;

          if (crop) {
            sourceX = crop.x;
            sourceY = crop.y;
            sourceWidth = crop.width;
            sourceHeight =
              crop.height;
          }

          const canvas =
            document.createElement(
              "canvas"
            );

          canvas.width =
            sourceWidth * scale;

          canvas.height =
            sourceHeight * scale;

          const ctx =
            canvas.getContext("2d");

          ctx.fillStyle = "white";

          ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
          );

          ctx.filter =
            "grayscale(1) contrast(1.35) brightness(1.05)";

          ctx.drawImage(
            img,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            canvas.width,
            canvas.height
          );

          resolve(
            canvas.toDataURL(
              "image/jpeg",
              0.95
            )
          );
        };

        img.onerror = reject;

        img.src = source;
      }
    );
  };

  // =========================================================
  // OCR TEXT
  // =========================================================

  const recognizeImage = async (
    imageUrl,
    worker
  ) => {
    const processed =
      await createProcessedImage(
        imageUrl
      );

    const response =
      await worker.recognize(
        processed
      );

    return response.data.text || "";
  };

  // =========================================================
  // DETECT TWO SIDE-BY-SIDE BILLS
  // =========================================================

  const detectMultipleBills = (
    text
  ) => {
    const lower = text.toLowerCase();

    let score = 0;

    // Strong indicators that two documents
    // are present in one image

    const grandTotals =
      (
        lower.match(
          /grand\s*total/g
        ) || []
      ).length;

    const billNumbers =
      (
        lower.match(
          /bill\s*(no|number)/g
        ) || []
      ).length;

    const taxInvoices =
      (
        lower.match(
          /tax\s*invoice/g
        ) || []
      ).length;

    const restaurantCount =
      (
        lower.match(
          /restaurant/g
        ) || []
      ).length;

    const amountPaid =
      (
        lower.match(
          /amount\s*paid/g
        ) || []
      ).length;

    const totalCount =
      (
        lower.match(
          /(?:^|\n)\s*total/gm
        ) || []
      ).length;

    if (grandTotals >= 2) {
      score += 3;
    }

    if (billNumbers >= 2) {
      score += 3;
    }

    if (taxInvoices >= 2) {
      score += 2;
    }

    if (restaurantCount >= 2) {
      score += 2;
    }

    if (amountPaid >= 2) {
      score += 2;
    }

    if (totalCount >= 2) {
      score += 1;
    }

    return score >= 3;
  };

  // =========================================================
  // OCR ONE BILL
  // =========================================================

  const processBillText = (
    text,
    imageUrl
  ) => {
    if (!isBill(text)) {
      return {
        success: false,

        message:
          "This image does not appear to contain a recognizable transaction.",

        ocrText: text,
      };
    }

    const amount =
      extractAmount(text);

    if (!amount || amount <= 0) {
      return {
        success: false,

        message:
          "Transaction amount could not be detected.",

        ocrText: text,
      };
    }

    const type =
      detectType(text);

    const category =
      detectCategory(text);

    const title =
      extractTitle(
        text,
        category
      );

    const date =
      extractDate(text);

    return {
      success: true,

      data: {
        title,
        amount,
        type,
        category,
        date,

        description:
          "Automatically extracted from transaction document",

        imageUrl,

        ocrText: text,
      },

      ocrText: text,
    };
  };

  // =========================================================
  // SCAN ONE IMAGE
  // =========================================================

  const scanOneImage = async (
    imageUrl,
    worker
  ) => {
    try {
      // First OCR the COMPLETE image.
      // This tells us whether the image contains
      // one bill or multiple side-by-side bills.

      const fullText =
        await recognizeImage(
          imageUrl,
          worker
        );

      console.log(
        "FULL IMAGE OCR:",
        fullText
      );

      // -----------------------------------------------------
      // CHECK FOR MULTIPLE BILLS
      // -----------------------------------------------------

      const multipleBills =
        detectMultipleBills(
          fullText
        );

      if (multipleBills) {
        console.log(
          "Multiple bills detected. Splitting image..."
        );

        const img =
          new Image();

        img.src = imageUrl;

        await new Promise(
          (resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          }
        );

        const middle =
          Math.floor(
            img.width / 2
          );

        // LEFT HALF

        const leftCrop = {
          x: 0,
          y: 0,
          width: middle,
          height: img.height,
        };

        // RIGHT HALF

        const rightCrop = {
          x: middle,
          y: 0,
          width:
            img.width - middle,
          height: img.height,
        };

        const leftImage =
          await createProcessedImage(
            imageUrl,
            leftCrop
          );

        const rightImage =
          await createProcessedImage(
            imageUrl,
            rightCrop
          );

        // OCR LEFT

        const leftResponse =
          await worker.recognize(
            leftImage
          );

        const leftText =
          leftResponse.data.text ||
          "";

        console.log(
          "LEFT BILL OCR:",
          leftText
        );

        // OCR RIGHT

        const rightResponse =
          await worker.recognize(
            rightImage
          );

        const rightText =
          rightResponse.data.text ||
          "";

        console.log(
          "RIGHT BILL OCR:",
          rightText
        );

        const leftResult =
          processBillText(
            leftText,
            leftImage
          );

        const rightResult =
          processBillText(
            rightText,
            rightImage
          );

        return [
          {
            ...leftResult,
            splitBill: true,
            side: "left",
          },

          {
            ...rightResult,
            splitBill: true,
            side: "right",
          },
        ];
      }

      // -----------------------------------------------------
      // NORMAL SINGLE BILL
      // -----------------------------------------------------

      const singleResult =
        processBillText(
          fullText,
          imageUrl
        );

      return [
        singleResult,
      ];
    } catch (error) {
      console.error(
        "Error scanning image:",
        error
      );

      return [
        {
          success: false,

          message:
            "Could not read this transaction document.",

          ocrText: "",
        },
      ];
    }
  };

  // =========================================================
  // SCAN ALL SELECTED IMAGES
  // =========================================================

  const scanBills = async () => {
    if (images.length === 0) {
      alert(
        "Please take or upload at least one bill."
      );
      return;
    }

    try {
      setScanning(true);
      setProgress(0);
      setResults([]);
      setOcrText("");

      const worker =
        await createWorker(
          "eng",
          1,
          {
            logger: (message) => {
              if (
                message.status ===
                "recognizing text"
              ) {
                setProgress(
                  Math.round(
                    message.progress *
                      100
                  )
                );
              }
            },
          }
        );

      await worker.setParameters(
        {
          tessedit_pageseg_mode:
            "6",
        }
      );

      const allResults = [];

      for (
        let i = 0;
        i < images.length;
        i++
      ) {
        const image =
          images[i];

        const imageResults =
          await scanOneImage(
            image.url,
            worker
          );

        imageResults.forEach(
          (result, resultIndex) => {
            allResults.push({
              id: `${image.id}-${resultIndex}`,

              originalImageId:
                image.id,

              ...result,
            });
          }
        );

        setProgress(
          Math.round(
            ((i + 1) /
              images.length) *
              100
          )
        );
      }

      await worker.terminate();

      setResults(
        allResults
      );

      // -----------------------------------------------------
      // OCR DISPLAY
      // -----------------------------------------------------

      const allOCRText =
        allResults
          .map(
            (item, index) =>
              `Bill ${
                index + 1
              }\n\n${
                item.ocrText ||
                item.data?.ocrText ||
                item.message
              }`
          )
          .join(
            "\n\n--------------------\n\n"
          );

      setOcrText(
        allOCRText
      );

      setScanning(false);

      const successful =
        allResults.filter(
          (item) =>
            item.success
        ).length;

      const failed =
        allResults.length -
        successful;

      if (failed > 0) {
        alert(
          `${successful} transaction(s) detected successfully. ${failed} could not be read.`
        );
      }
    } catch (error) {
      console.error(
        "OCR Error:",
        error
      );

      setScanning(false);

      alert(
        "Could not scan the transactions. Please try again."
      );
    }
  };

  // =========================================================
  // SAVE ALL TRANSACTIONS
  // =========================================================

  const saveAllTransactions =
    async () => {
      const validResults =
        results.filter(
          (item) =>
            item.success &&
            item.data
        );

      if (
        validResults.length === 0
      ) {
        alert(
          "There are no valid transactions to save."
        );
        return;
      }

      try {
        const token =
          localStorage.getItem(
            "token"
          );

        if (!token) {
          alert(
            "Please login again."
          );
          return;
        }

        let savedCount = 0;

        for (
          const item of validResults
        ) {
          const transaction =
            item.data;

          await api.post(
            "/transactions",
            {
              title:
                transaction.title,

              amount: Number(
                transaction.amount
              ),

              type:
                transaction.type,

              category:
                transaction.category,

              date:
                transaction.date,

              description:
                transaction.description,
            },
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

          savedCount++;
        }

        alert(
          `${savedCount} transaction(s) added successfully!`
        );

        if (
          fetchTransactions
        ) {
          await fetchTransactions();
        }

        clearImages();
      } catch (error) {
        console.error(
          "Save transactions error:",
          error
        );

        alert(
          error.response
            ?.data?.message ||
            error.message ||
            "Failed to save transactions."
        );
      }
    };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="card p-4 mt-4 shadow">

      <h3 className="text-center mb-3">
        Scan Bills & Add Transactions
      </h3>

      <p className="text-center text-muted">
        Take photos or upload transaction
        documents.
      </p>

      {/* CAMERA */}

      {!cameraOpen && (
        <button
          type="button"
          className="btn btn-primary w-100 mb-2"
          onClick={openCamera}
        >
          📷 Take Photo
        </button>
      )}

      {/* FILE INPUT */}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={
          handleImageChange
        }
        style={{
          display: "none",
        }}
      />

      {!cameraOpen && (
        <button
          type="button"
          className="btn btn-secondary w-100 mb-3"
          onClick={() =>
            fileInputRef.current?.click()
          }
        >
          🖼️ Upload Multiple Bills
        </button>
      )}

      {/* CAMERA VIEW */}

      {cameraOpen && (
        <div className="mb-3">

          <div
            style={{
              width: "100%",
              background: "#000",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                display: "block",
              }}
            />
          </div>

          <div className="d-flex gap-2 mt-3">

            <button
              type="button"
              className="btn btn-success flex-grow-1"
              onClick={
                capturePhoto
              }
            >
              📸 Capture & Add Bill
            </button>

            <button
              type="button"
              className="btn btn-danger"
              onClick={
                closeCamera
              }
            >
              ✕ Close
            </button>

          </div>

        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          display: "none",
        }}
      />

      {/* CAMERA ERROR */}

      {cameraError && (
        <div className="alert alert-danger">
          {cameraError}
        </div>
      )}

      {/* IMAGE COUNT */}

      {images.length > 0 && (
        <div className="alert alert-info">
          <strong>
            {images.length}
          </strong>{" "}
          image
          {images.length !== 1
            ? "s"
            : ""}{" "}
          selected.
        </div>
      )}

      {/* IMAGE PREVIEWS */}

      {images.length > 0 && (
        <div className="row g-3 mb-3">

          {images.map(
            (image, index) => (
              <div
                className="col-6 col-md-4"
                key={image.id}
              >

                <div
                  style={{
                    position:
                      "relative",
                  }}
                >

                  <img
                    src={image.url}
                    alt={`Bill ${
                      index + 1
                    }`}
                    style={{
                      width: "100%",
                      height: "160px",
                      objectFit:
                        "contain",
                      borderRadius:
                        "10px",
                      border:
                        "1px solid #ddd",
                    }}
                  />

                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      removeImage(
                        image.id
                      )
                    }
                    style={{
                      position:
                        "absolute",
                      top: "5px",
                      right: "5px",
                    }}
                  >
                    ✕
                  </button>

                  <div className="text-center mt-1">
                    Image{" "}
                    {index + 1}
                  </div>

                </div>

              </div>
            )
          )}

        </div>
      )}

      {/* SCAN BUTTON */}

      {!cameraOpen && (
        <button
          type="button"
          className="btn btn-success w-100 mb-2"
          onClick={
            scanBills
          }
          disabled={
            scanning ||
            images.length === 0
          }
        >
          {scanning
            ? `Scanning... ${progress}%`
            : "🔍 Scan All Bills"}
        </button>
      )}

      {/* CLEAR */}

      {images.length > 0 &&
        !scanning && (
          <button
            type="button"
            className="btn btn-outline-danger w-100 mb-3"
            onClick={
              clearImages
            }
          >
            🗑️ Clear All Bills
          </button>
        )}

      {/* PROGRESS */}

      {scanning && (
        <div className="progress mb-3">

          <div
            className="progress-bar"
            role="progressbar"
            style={{
              width: `${progress}%`,
            }}
          >
            {progress}%
          </div>

        </div>
      )}

      {/* RESULTS */}

      {results.length > 0 && (
        <div className="mt-4">

          <h5 className="mb-3">
            Extracted Transactions
          </h5>

          {results.map(
            (item, index) => (
              <div
                key={item.id}
                className="card p-3 mb-3"
              >

                <h6>
                  Bill{" "}
                  {index + 1}
                </h6>

                {item.success ? (
                  <>

                    <div className="mb-1">
                      <strong>
                        Title:
                      </strong>{" "}
                      {
                        item.data
                          .title
                      }
                    </div>

                    <div className="mb-1">
                      <strong>
                        Amount:
                      </strong>{" "}
                      ₹
                      {
                        item.data
                          .amount
                      }
                    </div>

                    <div className="mb-1">
                      <strong>
                        Type:
                      </strong>{" "}
                      {item.data
                        .type ===
                      "income"
                        ? "Income"
                        : "Expense"}
                    </div>

                    <div className="mb-1">
                      <strong>
                        Category:
                      </strong>{" "}
                      {
                        item.data
                          .category
                      }
                    </div>

                    <div>
                      <strong>
                        Date:
                      </strong>{" "}
                      {
                        item.data
                          .date
                      }
                    </div>

                  </>
                ) : (
                  <div className="alert alert-warning mb-0">
                    ⚠️{" "}
                    {item.message}
                  </div>
                )}

              </div>
            )
          )}

          {/* SAVE */}

          {results.some(
            (item) =>
              item.success
          ) && (
            <button
              type="button"
              className="btn btn-success w-100"
              onClick={
                saveAllTransactions
              }
            >
              💾 Save All Transactions
            </button>
          )}

        </div>
      )}

      {/* OCR TEXT */}

      {ocrText && (
        <details className="mt-3">

          <summary>
            View OCR Text
          </summary>

          <pre
            style={{
              whiteSpace:
                "pre-wrap",
              fontSize: "12px",
              maxHeight:
                "300px",
              overflowY:
                "auto",
            }}
          >
            {ocrText}
          </pre>

        </details>
      )}

    </div>
  );
}

export default BillScanner;