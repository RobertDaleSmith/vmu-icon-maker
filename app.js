const scaleFactor = 8; // Scale factor for enlarging each pixel

// Global variable to store palette indices
let storedPaletteIndices = new Array(32 * 32).fill(1);
let monoPixelStates = new Array(32 * 32).fill(false); // Initialize all pixels to "off" (white)

// Global variable to store the current palette
let currentPalette = [];

// Global variables for color selection
let primaryColor = '#000000FF'; // Default primary color
let secondaryColor = '#FFFFFFFF'; // Default secondary color
let primaryColorIndex = 0; // Default index for primary color
let secondaryColorIndex = 1; // Default index for secondary color

document.getElementById('color-file').addEventListener('change', function(event) {
  handleFile(event, 'color');
});

document.getElementById('mono-file').addEventListener('change', function(event) {
  handleFile(event, 'mono');
});

document.getElementById('description').addEventListener('input', updateSaveButtonState);

document.getElementById('vms-file').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const vmsData = new Uint8Array(e.target.result);
            parseVMSFile(vmsData);
        };
        reader.readAsArrayBuffer(file);
    }
});

document.getElementById('save-button').addEventListener('click', saveVMSVMI);

function handleFile(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
          if (type === 'color') {
              processColorImage(img);
          } else {
              processMonoImage(img);
          }
      };
      img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function processColorImage(img) {
  // Create an invisible 32x32 canvas
  const hiddenCanvas = document.createElement('canvas');
  hiddenCanvas.width = 32;
  hiddenCanvas.height = 32;
  const hiddenCtx = hiddenCanvas.getContext('2d');

  // Draw the image onto the 32x32 canvas
  hiddenCtx.drawImage(img, 0, 0, 32, 32);

  // Extract image data from the 32x32 canvas
  const imageData = hiddenCtx.getImageData(0, 0, 32, 32);
  const colors = extractColors(imageData);

  // Check if transparent color exists in the image
  const transparentColor = { r: 255, g: 255, b: 255, a: 0 };
  const hasTransparent = colors.some(color => color.a === 0);

  // Reduce the color palette to 16 colors
  let reducedPalette = reducePalette(colors, hasTransparent ? 15 : 16);

  // Quantize colors to 4 bits per channel
  const quantizedColors = reducedPalette.map(color => ({
    r: Math.round((color.r / 255) * 15) * 17,
    g: Math.round((color.g / 255) * 15) * 17,
    b: Math.round((color.b / 255) * 15) * 17,
    a: color.a // Keep alpha as is
  }));

  // If transparent color was present, add it to the end of the palette
  if (hasTransparent) {
    quantizedColors.push(transparentColor);
  }

  // Ensure the palette has at least 16 colors
  while (quantizedColors.length < 16) {
    quantizedColors.push(transparentColor);
  }

  // Update the palette indices for each pixel
  storedPaletteIndices = updatePaletteIndices(imageData, quantizedColors, transparentColor);

  // Store the current palette
  currentPalette = quantizedColors;

  // Apply the reduced palette and palette indices to the visible canvas
  applyPaletteToCanvas(storedPaletteIndices, quantizedColors);

  displayColorPalette(quantizedColors);
  updateSaveButtonState();
}

function applyPaletteToCanvas(paletteIndices, palette) {
  const canvas = document.getElementById('color-canvas');
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(32, 32);

  for (let i = 0; i < paletteIndices.length; i++) {
    const color = palette[paletteIndices[i]];
    const index = i * 4;
    imageData.data[index] = color.r;
    imageData.data[index + 1] = color.g;
    imageData.data[index + 2] = color.b;
    imageData.data[index + 3] = color.a; // Use the alpha value from the palette
  }

  // Draw the 32x32 image data onto the canvas
  ctx.putImageData(imageData, 0, 0);

  // Scale the 32x32 image data to the full canvas size
  const scaledImageData = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const originalIndex = (y * 32 + x) * 4;
      for (let dy = 0; dy < scaleFactor; dy++) {
        for (let dx = 0; dx < scaleFactor; dx++) {
          const scaledIndex = ((y * scaleFactor + dy) * canvas.width + (x * scaleFactor + dx)) * 4;
          scaledImageData.data[scaledIndex] = imageData.data[originalIndex];
          scaledImageData.data[scaledIndex + 1] = imageData.data[originalIndex + 1];
          scaledImageData.data[scaledIndex + 2] = imageData.data[originalIndex + 2];
          scaledImageData.data[scaledIndex + 3] = imageData.data[originalIndex + 3];
        }
      }
    }
  }

  ctx.putImageData(scaledImageData, 0, 0);
}

function extractColors(imageData) {
  const colors = new Map();
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];
    const color = (r << 16) | (g << 8) | b;
    if (!colors.has(color)) {
      colors.set(color, { r, g, b, a });
    }
  }
  return Array.from(colors.values());
}

function reducePalette(colors, maxColors) {
  const colorsToReduce = colors.filter(color => color.a !== 0);

  while (colorsToReduce.length > maxColors) {
    let minDistance = Infinity;
    let pairToMerge = [0, 1];

    // Find the closest pair of colors
    for (let i = 0; i < colorsToReduce.length; i++) {
      for (let j = i + 1; j < colorsToReduce.length; j++) {
        const distance = colorDistance(colorsToReduce[i], colorsToReduce[j]);
        if (distance < minDistance) {
          minDistance = distance;
          pairToMerge = [i, j];
        }
      }
    }

    // Merge the closest pair
    const [index1, index2] = pairToMerge;
    const mergedColor = averageColor(colorsToReduce[index1], colorsToReduce[index2]);
    colorsToReduce.splice(index2, 1);
    colorsToReduce[index1] = mergedColor;
  }

  return colorsToReduce;
}

function colorDistance(color1, color2) {
  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
    Math.pow(color1.g - color2.g, 2) +
    Math.pow(color1.b - color2.b, 2)
  );
}

function averageColor(color1, color2) {
  return {
    r: Math.round((color1.r + color2.r) / 2),
    g: Math.round((color1.g + color2.g) / 2),
    b: Math.round((color1.b + color2.b) / 2),
    a: Math.round((color1.a + color2.a) / 2)
  };
}

function updatePaletteIndices(imageData, palette, transparentColor) {
  const indices = [];
  const transparentIndex = palette.findIndex(color => color.a === 0);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];

    if (a === 0) {
      // Assign the transparent index if the pixel is transparent
      indices.push(transparentIndex);
    } else {
      // Find the closest palette index for non-transparent pixels
      const index = findClosestPaletteIndex(r, g, b, palette);
      indices.push(index);
    }
  }
  return indices;
}

function findClosestPaletteIndex(r, g, b, palette) {
  let closestIndex = 0;
  let minDistance = Infinity;
  palette.forEach((color, index) => {
    const distance = colorDistance({ r, g, b }, color);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  });
  return closestIndex;
}

function processMonoImage(img) {
    // Create an invisible 32x32 canvas
    const hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.width = 32;
    hiddenCanvas.height = 32;
    const hiddenCtx = hiddenCanvas.getContext('2d');

    // Draw the image onto the 32x32 canvas
    hiddenCtx.drawImage(img, 0, 0, 32, 32);

    // Extract image data from the 32x32 canvas
    const imageData = hiddenCtx.getImageData(0, 0, 32, 32);
    const data = imageData.data;

    // Define a threshold for converting to black or transparent
    const threshold = 64; // Adjust this value as needed

    // Process each pixel
    monoPixelStates = []; // Reset monoPixelStates
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calculate brightness
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        if (brightness > threshold) {
            // Set pixel to transparent
            data[i + 3] = 0; // Alpha channel
            monoPixelStates.push(false);
        } else {
            // Set pixel to black
            data[i] = 0;     // Red channel
            data[i + 1] = 0; // Green channel
            data[i + 2] = 0; // Blue channel
            data[i + 3] = 255; // Alpha channel
            monoPixelStates.push(true);
        }
    }

    // Put the modified image data back onto the hidden canvas
    hiddenCtx.putImageData(imageData, 0, 0);

    // Draw the processed 32x32 image data onto the visible canvas
    const canvas = document.getElementById('mono-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Disable image smoothing to maintain sharp pixel edges
    ctx.imageSmoothingEnabled = false;

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
    ctx.drawImage(hiddenCanvas, 0, 0, canvas.width, canvas.height);

    // Update the save button state
    updateSaveButtonState();
}

function updateSaveButtonState() {
  const description = document.getElementById('description').value;
  const saveButton = document.getElementById('save-button');
  // Add logic to enable/disable save button based on conditions
  const otherConditions = true; // Replace with actual conditions
  saveButton.disabled = !(description && otherConditions);
}

function saveVMSVMI() {
    // Retrieve the description value
    const description = document.getElementById('description').value;

    // Create VMI and VMS data
    const vmiData = createVMIData();
    const vmsData = createVMSData(description, monoPixelStates, storedPaletteIndices, currentPalette);

    // Save VMI file
    saveFile(vmiData, 'ICONDATA.VMI');

    // Save VMS file
    saveFile(vmsData, 'ICONDATA.VMS');

    console.log('ICONDATA.VMI and ICONDATA.VMS saved.');
}

function createVMIData() {
  const now = new Date();
  const vmiData = new Uint8Array(108);

  // Fill VMI data based on the Python logic
  vmiData.set([0x41, 0x41, 0x47, 0x40], 0); // 0x00, 4 bytes
  vmiData.set(new TextEncoder().encode('ICONDATA_GENERATOR').slice(0, 32), 4); // 0x04, 32 bytes
  vmiData.set(new TextEncoder().encode('@pomegd').slice(0, 32), 36); // 0x24, 32 bytes
  vmiData.set([now.getFullYear() & 0xFF, (now.getFullYear() >> 8) & 0xFF], 68); // 0x44, 2 bytes
  vmiData.set([now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()], 70); // 0x46-0x4A, 5 bytes
  vmiData[75] = (now.getDay() + 1) % 7; // 0x4B, 1 byte
  vmiData.set([0x00, 0x01, 0x01, 0x00], 76); // 0x4C-0x4F, 4 bytes
  vmiData.set(new TextEncoder().encode('ICONDATAICONDATA_VMS').slice(0, 20), 80); // 0x50, 20 bytes
  vmiData.set([0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00], 100); // 0x64-0x6B, 8 bytes

  return vmiData;
}

function createVMSData(description, monoPixelStates, storedPaletteIndices, currentPalette) {
    const vmsData = new Uint8Array(1024);

    // 0x00, 16 bytes: Description
    const descriptionBytes = new TextEncoder('shift_jis').encode(description).slice(0, 16);
    vmsData.set(descriptionBytes, 0);

    // 0x10, 16 bytes: Fixed values
    vmsData.set([0x20, 0x00, 0x00, 0x00, 0xA0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 16);

    // 0x20, 128 bytes: Mono bitmap data
    const monoBitmapBytes = convertMonoPixelStatesToBitmap(monoPixelStates);
    vmsData.set(monoBitmapBytes, 32);

    // 0xA0, 32 bytes: Color palette
    const colorPaletteBytes = convertPaletteToBytes(currentPalette);
    vmsData.set(colorPaletteBytes, 160);

    // 0xC0, 512 bytes: Color bitmap data
    const colorBitmapBytes = convertPaletteIndicesToBitmap(storedPaletteIndices);
    vmsData.set(colorBitmapBytes, 192);

    // 0x2C0, 320 bytes: Fixed values
    vmsData.set(new Uint8Array(320).fill(0x00), 704);

    return vmsData;
}

function convertMonoPixelStatesToBitmap(monoPixelStates) {
    const bytes = [];
    for (let i = 0; i < monoPixelStates.length; i += 8) {
        const byte = monoPixelStates.slice(i, i + 8).reduce((acc, bit, index) => acc | (bit ? 1 : 0) << (7 - index), 0);
        bytes.push(byte);
    }
    return new Uint8Array(bytes.slice(0, 128));
}

function convertPaletteToBytes(palette) {
    const bytes = [];
    palette.forEach(color => {
        // Convert each color channel to 4 bits (0-15) and pack them into bytes
        const g = ((color.g >> 4) & 0xF) << 4 | ((color.b >> 4) & 0xF);
        const a = ((color.a >> 4) & 0xF) << 4 | ((color.r >> 4) & 0xF);
        bytes.push(g, a);
    });
    while (bytes.length < 32) {
        bytes.push(0x00);
    }
    return new Uint8Array(bytes.slice(0, 32));
}

function convertPaletteIndicesToBitmap(paletteIndices) {
    const bytes = [];
    for (let i = 0; i < paletteIndices.length; i += 2) {
        const byte = (paletteIndices[i] << 4) | (paletteIndices[i + 1] || 0);
        bytes.push(byte);
    }
    return new Uint8Array(bytes.slice(0, 512));
}

function getColorIndex(r, g, b, palette) {
    let closestIndex = 0;
    let minDistance = Infinity;
    for (let i = 0; i < palette.length; i += 2) {
        const pr = (palette[i + 1] & 0x0F) * 17;
        const pg = (palette[i] >> 4) * 17;
        const pb = (palette[i] & 0x0F) * 17;

        const distance = Math.sqrt(
            Math.pow(r - pr, 2) +
            Math.pow(g - pg, 2) +
            Math.pow(b - pb, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i / 2;
        }
    }
    return closestIndex;
}

function convertToColorBitmap(imageData, palette) {
    const bitmap = [];
    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x += 2) {
            const index1 = (y * imageData.width + x) * 4;
            const index2 = (y * imageData.width + x + 1) * 4;

            const color1 = getColorIndex(imageData.data[index1], imageData.data[index1 + 1], imageData.data[index1 + 2], palette);
            const color2 = getColorIndex(imageData.data[index2], imageData.data[index2 + 1], imageData.data[index2 + 2], palette);

            const byte = (color1 << 4) | color2;
            bitmap.push(byte);
        }
    }
    return new Uint8Array(bitmap.slice(0, 512));
}

function saveFile(data, filename) {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function parseVMSFile(vmsData) {
    // Attempt to detect ICONDATA_VMS file
    const isIconDataVMS = checkForIconDataSignature(vmsData) || checkForKnownPatterns(vmsData);

    if (isIconDataVMS) {
        console.log('Detected ICONDATA_VMS file');
        const colorIconOffset = (vmsData[20] | (vmsData[21] << 8) | (vmsData[22] << 16) | (vmsData[23] << 24));
        parseIconData(vmsData, colorIconOffset);
    } else {
        console.log('Detected game save file');
        parseSaveFileIcon(vmsData);
    }

    // Parse the main description for both file types
    parseMainDescription(vmsData);

    // Parse the boot ROM description only for game save files
    if (!isIconDataVMS) {
        parseBootRomDescription(vmsData);
    }
}

function checkForIconDataSignature(vmsData) {
    // Example check: Look for a specific header or pattern
    const signature = [0x41, 0x41, 0x47, 0x40]; // Example signature
    for (let i = 0; i < signature.length; i++) {
        if (vmsData[i] !== signature[i]) {
            return false;
        }
    }
    return true;
}

function checkForKnownPatterns(vmsData) {
    // Additional checks for known patterns or structures
    // Example: Check for specific offsets or data structures
    // This is a placeholder; replace with actual checks
    const knownPatternOffset = 0x10; // Example offset
    const knownPattern = [0x20, 0x00, 0x00, 0x00]; // Example pattern
    for (let i = 0; i < knownPattern.length; i++) {
        if (vmsData[knownPatternOffset + i] !== knownPattern[i]) {
            return false;
        }
    }
    return true;
}

function parseMainDescription(data) {
    // Parse the first 16 bytes for the VMS file menu description
    const menuDescriptionBytes = data.slice(0, 16);
    const menuDescription = new TextDecoder('shift_jis').decode(menuDescriptionBytes).replace(/\0/g, '').trim();
    console.log('Menu Description:', menuDescription);

    // Update the UI with the menu description
    document.getElementById('menu-description').textContent = menuDescription;
    document.getElementById('description').value = menuDescription;
}

function parseBootRomDescription(data) {
    // Parse the next 32 bytes for the DC boot ROM file manager description
    const bootRomDescriptionBytes = data.slice(16, 48);
    const bootRomDescription = new TextDecoder('shift_jis').decode(bootRomDescriptionBytes).replace(/\0/g, '').trim();
    console.log('Boot ROM Description:', bootRomDescription);

    // Update the UI with the boot ROM description
    document.getElementById('boot-rom-description').textContent = bootRomDescription;
}

function parseIconData(data, offset) {
    const paletteOffset = offset;
    const bitmapOffset = offset + 32;
    const paletteSize = 32;
    const bitmapSize = 512;

    if (data.length >= bitmapOffset + bitmapSize) {
        const paletteData = data.slice(paletteOffset, paletteOffset + paletteSize);
        const bitmapData = data.slice(bitmapOffset, bitmapOffset + bitmapSize);
        const colorPalette = parseIconPalette(paletteData);
        const colorImageData = convertBitmapToImageData(bitmapData, colorPalette);
        drawImageDataToCanvas(colorImageData, 'color-canvas');

        console.log(colorPalette);

        // Display the color palette
        displayColorPalette(colorPalette);
    } else {
        console.error('File is too short to contain icon data');
    }

    // Parse monochrome icon if present
    const monoBitmapOffset = offset - 128; // Adjust based on actual format
    const monoBitmapSize = 128; // 32x32 pixels, 1 bit per pixel

    if (data.length >= monoBitmapOffset + monoBitmapSize) {
        const monoBitmapData = data.slice(monoBitmapOffset, monoBitmapOffset + monoBitmapSize);
        const monoImageData = convertMonoBitmapToImageData(monoBitmapData);
        drawImageDataToCanvas(monoImageData, 'mono-canvas');

        // Update monoPixelStates
        updateMonoPixelStates(monoBitmapData);
    } else {
        console.error('File is too short to contain monochrome icon data');
    }
}

function parseIconPalette(paletteData) {
    const palette = [];
    for (let i = 0; i < paletteData.length; i += 2) {
        const color = (paletteData[i + 1] << 8) | paletteData[i];
        const a = ((color >> 12) & 0xF) * 17; // Scale 4-bit alpha to 8-bit
        const r = ((color >> 8) & 0xF) * 17;  // Scale 4-bit red to 8-bit
        const g = ((color >> 4) & 0xF) * 17;  // Scale 4-bit green to 8-bit
        const b = (color & 0xF) * 17;         // Scale 4-bit blue to 8-bit
        palette.push({ r, g, b, a });
    }
    return palette;
}

function convertBitmapToImageData(bitmapData, palette) {
    const imageData = new ImageData(32, 32);
    storedPaletteIndices = []; // Reset the stored indices

    for (let i = 0; i < bitmapData.length; i++) {
        const byte = bitmapData[i];
        const highNibble = byte >> 4;
        const lowNibble = byte & 0x0F;

        const highColor = palette[highNibble];
        const lowColor = palette[lowNibble];

        const highIndex = i * 2 * 4;
        const lowIndex = (i * 2 + 1) * 4;

        imageData.data[highIndex] = highColor.r;
        imageData.data[highIndex + 1] = highColor.g;
        imageData.data[highIndex + 2] = highColor.b;
        imageData.data[highIndex + 3] = highColor.a;

        imageData.data[lowIndex] = lowColor.r;
        imageData.data[lowIndex + 1] = lowColor.g;
        imageData.data[lowIndex + 2] = lowColor.b;
        imageData.data[lowIndex + 3] = lowColor.a;

        // Store the palette indices
        storedPaletteIndices.push(highNibble, lowNibble);
    }
    return imageData;
}

function drawImageDataToCanvas(imageData, canvasId) {
    console.log('drawImageDataToCanvas', imageData);
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const scaledWidth = imageData.width * scaleFactor;
    const scaledHeight = imageData.height * scaleFactor;

    // Resize the canvas to match the scaled dimensions
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    // Create a new ImageData object for the scaled image
    const scaledImageData = ctx.createImageData(scaledWidth, scaledHeight);

    // Define the default color (white) for uncolored pixels
    // const defaultColor = { r: 255, g: 255, b: 255, a: 255 };

    // Scale each pixel
    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
            const index = (y * imageData.width + x) * 4;
            let r = imageData.data[index];
            let g = imageData.data[index + 1];
            let b = imageData.data[index + 2];
            let a = imageData.data[index + 3];

            // If the alpha is 0, use the default color
            // if (a === 0) {
            //     r = defaultColor.r;
            //     g = defaultColor.g;
            //     b = defaultColor.b;
            //     a = defaultColor.a;
            // }

            // Draw the scaled pixel
            for (let dy = 0; dy < scaleFactor; dy++) {
                for (let dx = 0; dx < scaleFactor; dx++) {
                    const scaledIndex = ((y * scaleFactor + dy) * scaledWidth + (x * scaleFactor + dx)) * 4;
                    scaledImageData.data[scaledIndex] = r;
                    scaledImageData.data[scaledIndex + 1] = g;
                    scaledImageData.data[scaledIndex + 2] = b;
                    scaledImageData.data[scaledIndex + 3] = a;
                }
            }
        }
    }

    // Put the scaled image data onto the canvas
    ctx.putImageData(scaledImageData, 0, 0);
    console.log(`Image drawn on ${canvasId} with scale factor ${scaleFactor}`);
}

function getOriginalImageData(canvasId) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const originalWidth = 32;
    const originalHeight = 32;
    const originalImageData = ctx.createImageData(originalWidth, originalHeight);

    // Extract the original 32x32 image data from the scaled canvas
    for (let y = 0; y < originalHeight; y++) {
        for (let x = 0; x < originalWidth; x++) {
            const index = (y * originalWidth + x) * 4;
            const scaledIndex = ((y * scaleFactor) * canvas.width + (x * scaleFactor)) * 4;
            originalImageData.data[index] = ctx.getImageData(0, 0, canvas.width, canvas.height).data[scaledIndex];
            originalImageData.data[index + 1] = ctx.getImageData(0, 0, canvas.width, canvas.height).data[scaledIndex + 1];
            originalImageData.data[index + 2] = ctx.getImageData(0, 0, canvas.width, canvas.height).data[scaledIndex + 2];
            originalImageData.data[index + 3] = ctx.getImageData(0, 0, canvas.width, canvas.height).data[scaledIndex + 3];
        }
    }

    return originalImageData;
}

function parseSaveFileIcon(saveData) {
    // Read the header to find the icon palette and bitmap
    const paletteOffset = 0x60; // Offset for the icon palette
    const bitmapOffset = 0x80;  // Offset for the icon bitmap
    const paletteSize = 32;     // 16 colors, 2 bytes each
    const bitmapSize = 512;     // 32x32 pixels, 4 bits per pixel

    if (saveData.length >= bitmapOffset + bitmapSize) {
        const paletteData = saveData.slice(paletteOffset, paletteOffset + paletteSize);
        const bitmapData = saveData.slice(bitmapOffset, bitmapOffset + bitmapSize);
        const colorPalette = parseIconPalette(paletteData);
        const colorImageData = convertBitmapToImageData(bitmapData, colorPalette);
        drawImageDataToCanvas(colorImageData, 'color-canvas');

        // Display the color palette
        displayColorPalette(colorPalette);
    } else {
        console.error('Save file is too short to contain icon data');
    }
}

function convertMonoBitmapToImageData(bitmapBytes) {
    const imageData = new ImageData(32, 32);
    for (let i = 0; i < bitmapBytes.length; i++) {
        const byte = bitmapBytes[i];
        for (let bit = 0; bit < 8; bit++) {
            const pixelIndex = i * 8 + bit;
            const value = (byte & (1 << (7 - bit))) ? 0 : 255;
            const dataIndex = pixelIndex * 4;
            imageData.data[dataIndex] = value; // R
            imageData.data[dataIndex + 1] = value; // G
            imageData.data[dataIndex + 2] = value; // B
            imageData.data[dataIndex + 3] = 255; // A
        }
    }
    return imageData;
}

function displayColorPalette(palette) {
    const paletteContainer = document.getElementById('color-palette');
    paletteContainer.innerHTML = ''; // Clear previous palette

    const squareSize = 20; // Size of each color square
    const columns = 8; // Number of columns in the grid
    const gap = '0 2'; // Gap between squares

    // Calculate the total width of the palette container
    const totalWidth = columns * (squareSize + gap) - gap; // Subtract the last gap

    // Set the palette container to display as a grid
    paletteContainer.style.display = 'grid';
    paletteContainer.style.gridTemplateColumns = `repeat(${columns}, ${squareSize}px)`;
    paletteContainer.style.gap = `${gap}px`;
    paletteContainer.style.width = `${totalWidth}px`; // Set the calculated width

    palette.forEach((color, index) => {
        const colorDiv = document.createElement('div');
        colorDiv.style.width = `${squareSize}px`;
        colorDiv.style.height = `${squareSize}px`;
        colorDiv.style.backgroundColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
        colorDiv.style.cursor = 'pointer';
        colorDiv.style.border = '1px solid #ccc'; // Optional: Add a border for better visibility
        colorDiv.style.position = 'relative'; // Position relative to allow absolute positioning of the input

        // Create a color input element
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = rgbaToHex(color.r, color.g, color.b, color.a).slice(0, 7); // Use only RGB for the color input
        colorInput.style.position = 'absolute';
        colorInput.style.top = '0';
        colorInput.style.left = '0';
        colorInput.style.width = '100%';
        colorInput.style.height = '100%';
        colorInput.style.opacity = '0'; // Hide the input visually but keep it accessible
        colorInput.style.pointerEvents = 'none'; // Disable pointer events to prevent single click

        // Store the alpha value as a data attribute
        colorInput.setAttribute('data-alpha', (color.a & 0xFF).toString(16).padStart(2, '0'));

        // Single click to set primary color
        colorDiv.addEventListener('click', (e) => {
            if (e.button === 0) { // Left click
                const alphaHex = colorInput.getAttribute('data-alpha');
                primaryColor = colorInput.value + alphaHex; // Append the alpha value
                console.log(primaryColor);
                primaryColorIndex = index;
                updateColorIndicators();
            }
        });

        // Right click to set secondary color
        colorDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const alphaHex = colorInput.getAttribute('data-alpha');
            secondaryColor = colorInput.value + alphaHex; // Append the alpha value
            secondaryColorIndex = index;
            updateColorIndicators();
        });

        // Double click to open color picker
        colorDiv.addEventListener('dblclick', (e) => {
            e.preventDefault(); // Prevent any default action
            colorInput.style.pointerEvents = 'auto'; // Enable pointer events for double click
            colorInput.click();
            colorInput.style.pointerEvents = 'none'; // Disable again after click
        });

        // Add change event to update color
        colorInput.addEventListener('input', () => {
            const newColor = colorInput.value + 'FF'; // Append full opacity
            const rgba = hexToRgba(newColor);
            if (rgba) {
                console.log(`Updating color index ${index} to`, rgba);
                color.r = rgba.r;
                color.g = rgba.g;
                color.b = rgba.b;
                color.a = rgba.a;
                colorDiv.style.backgroundColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;

                // Update the canvas with the new palette
                updateCanvasWithPalette(palette);

                // Update the color indicators if this color is selected
                if (index === primaryColorIndex) {
                    primaryColor = newColor;
                    updateColorIndicators();
                } else if (index === secondaryColorIndex) {
                    secondaryColor = newColor;
                    updateColorIndicators();
                }
            }
        });

        colorDiv.appendChild(colorInput);
        paletteContainer.appendChild(colorDiv);
    });

    // Update color indicators based on the new palette
    if (primaryColorIndex >= palette.length) {
        primaryColorIndex = 0; // Reset to first color if out of bounds
    }
    if (secondaryColorIndex >= palette.length) {
        secondaryColorIndex = 1; // Reset to second color if out of bounds
    }

    primaryColor = rgbaToHex(palette[primaryColorIndex].r, palette[primaryColorIndex].g, palette[primaryColorIndex].b, palette[primaryColorIndex].a);
    secondaryColor = rgbaToHex(palette[secondaryColorIndex].r, palette[secondaryColorIndex].g, palette[secondaryColorIndex].b, palette[secondaryColorIndex].a);
    updateColorIndicators();

    // Store the current palette
    currentPalette = palette;
}

function updateColorIndicators() {
    const primaryIndicator = document.getElementById('primary-color-indicator');
    const secondaryIndicator = document.getElementById('secondary-color-indicator');
    primaryIndicator.style.backgroundColor = hexToRgbaString(primaryColor);
    secondaryIndicator.style.backgroundColor = hexToRgbaString(secondaryColor);
}

function setupCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    const pixelSize = 32; // Original pixel size
    canvas.width = pixelSize * scaleFactor;
    canvas.height = pixelSize * scaleFactor;
    const ctx = canvas.getContext('2d');

    let drawing = false;
    let currentButton = null;

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0 || e.button === 2) { // Left or right click
            drawing = true;
            currentButton = e.button;
            draw(e);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (drawing) {
            draw(e);
        }
    });

    canvas.addEventListener('mouseup', () => {
        drawing = false;
        currentButton = null;
        ctx.beginPath();
    });

    canvas.addEventListener('mouseleave', () => {
        drawing = false;
        currentButton = null;
        ctx.beginPath();
    });

    // Prevent the context menu from appearing on right-click
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    function draw(e) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / scaleFactor);
        const y = Math.floor((e.clientY - rect.top) / scaleFactor);

        if (canvasId === 'mono-canvas') {
            // For monochrome canvas, toggle pixel state
            const index = y * pixelSize + x;
            const isOn = currentButton === 0; // Left click turns "on" (black), right click clears (transparent)
            monoPixelStates[index] = isOn;

            if (isOn) {
                // Draw the pixel in black
                ctx.fillStyle = 'black';
                ctx.fillRect(x * scaleFactor, y * scaleFactor, scaleFactor, scaleFactor);
            } else {
                // Clear the pixel
                ctx.clearRect(x * scaleFactor, y * scaleFactor, scaleFactor, scaleFactor);
            }
        } else {
            // For color canvas, update storedPaletteIndices
            const color = currentButton === 2 ? secondaryColor : primaryColor;
            const colorIndex = currentButton === 2 ? secondaryColorIndex : primaryColorIndex;

            // Update the stored palette index for this pixel
            const index = y * pixelSize + x;
            storedPaletteIndices[index] = colorIndex;

            // Clear the pixel if the color is fully transparent
            if (color.endsWith('00')) {
                ctx.clearRect(x * scaleFactor, y * scaleFactor, scaleFactor, scaleFactor);
            } else {
                // Draw the scaled pixel
                ctx.fillStyle = color;
                ctx.fillRect(x * scaleFactor, y * scaleFactor, scaleFactor, scaleFactor);
            }
        }
    }
}

// Initialize the color indicators and both canvases
document.addEventListener('DOMContentLoaded', () => {
    updateColorIndicators();
    setupCanvas('color-canvas');
    setupCanvas('mono-canvas');

    // Define a default palette with 16 colors
    const defaultPalette = [
        { r: 0, g: 0, b: 0, a: 255 },    // Black
        { r: 255, g: 255, b: 255, a: 255 }, // White
        { r: 255, g: 0, b: 0, a: 255 },  // Red
        { r: 0, g: 255, b: 0, a: 255 },  // Green
        { r: 0, g: 0, b: 255, a: 255 },  // Blue
        { r: 255, g: 255, b: 0, a: 255 }, // Yellow
        { r: 0, g: 255, b: 255, a: 255 }, // Cyan
        { r: 255, g: 0, b: 255, a: 255 }, // Magenta
        { r: 192, g: 192, b: 192, a: 255 }, // Silver
        { r: 128, g: 128, b: 128, a: 255 }, // Gray
        { r: 128, g: 0, b: 0, a: 255 },  // Maroon
        { r: 128, g: 128, b: 0, a: 255 }, // Olive
        { r: 0, g: 128, b: 0, a: 255 },  // Dark Green
        { r: 128, g: 0, b: 128, a: 255 }, // Purple
        { r: 0, g: 128, b: 128, a: 255 }, // Teal
        { r: 0, g: 0, b: 128, a: 255 }   // Navy
    ];

    // Render the default palette
    displayColorPalette(defaultPalette);

    const vmsFileInput = document.getElementById('vms-file');
    const vmsUploadLabel = document.querySelector('label[for="vms-file"]');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        vmsUploadLabel.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        vmsUploadLabel.addEventListener(eventName, () => {
            vmsUploadLabel.classList.add('highlight');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        vmsUploadLabel.addEventListener(eventName, () => {
            vmsUploadLabel.classList.remove('highlight');
        }, false);
    });

    // Handle dropped files
    vmsUploadLabel.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length) {
            const file = files[0];
            if (file.name.toLowerCase().endsWith('.vms')) {
                handleVMSFile(file);
            } else {
                alert('Please drop a valid VMS file.');
            }
        }
    });

    function handleVMSFile(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const vmsData = new Uint8Array(e.target.result);
            parseVMSFile(vmsData);
        };
        reader.readAsArrayBuffer(file);
    }
});

function updateCanvasWithPalette(palette) {
    console.log('Updating canvas with new palette');
    const canvas = document.getElementById('color-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const originalWidth = 32;
    const originalHeight = 32;
    const imageData = ctx.createImageData(originalWidth, originalHeight);
    const data = imageData.data;

    // Assuming you have a stored array of palette indices for each pixel
    const paletteIndices = getStoredPaletteIndices(); // Implement this function to retrieve stored indices

    for (let i = 0; i < paletteIndices.length; i++) {
        const index = paletteIndices[i]; // Get the palette index for this pixel

        // Check if the index is valid
        if (index >= 0 && index < palette.length) {
            const color = palette[index]; // Get the new color from the updated palette

            if (color) {
                const pixelIndex = i * 4;
                data[pixelIndex] = color.r;
                data[pixelIndex + 1] = color.g;
                data[pixelIndex + 2] = color.b;
                data[pixelIndex + 3] = color.a; // Ensure alpha is also updated
            }
        }
    }

    // Draw the updated 32x32 image data onto the canvas
    ctx.putImageData(imageData, 0, 0);

    // Scale the 32x32 image data to the full canvas size
    const scaledImageData = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < originalHeight; y++) {
        for (let x = 0; x < originalWidth; x++) {
            const originalIndex = (y * originalWidth + x) * 4;
            for (let dy = 0; dy < scaleFactor; dy++) {
                for (let dx = 0; dx < scaleFactor; dx++) {
                    const scaledIndex = ((y * scaleFactor + dy) * canvas.width + (x * scaleFactor + dx)) * 4;
                    scaledImageData.data[scaledIndex] = data[originalIndex];
                    scaledImageData.data[scaledIndex + 1] = data[originalIndex + 1];
                    scaledImageData.data[scaledIndex + 2] = data[originalIndex + 2];
                    scaledImageData.data[scaledIndex + 3] = data[originalIndex + 3];
                }
            }
        }
    }

    ctx.putImageData(scaledImageData, 0, 0);
    console.log('Canvas updated with new palette');
}

function findClosestColor(r, g, b, palette) {
    let closestColor = palette[0];
    let minDistance = Infinity;

    palette.forEach(color => {
        const distance = Math.sqrt(
            Math.pow(r - color.r, 2) +
            Math.pow(g - color.g, 2) +
            Math.pow(b - color.b, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            closestColor = color;
        }
    });

    return closestColor;
}

function rgbaToHex(r, g, b, a) {
    const hexR = (r & 0xFF).toString(16).padStart(2, '0');
    const hexG = (g & 0xFF).toString(16).padStart(2, '0');
    const hexB = (b & 0xFF).toString(16).padStart(2, '0');
    const hexA = (a & 0xFF).toString(16).padStart(2, '0');
    return `#${hexR}${hexG}${hexB}${hexA}`.toUpperCase();
}

function hexToRgba(hex) {
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return match ? { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16), a: parseInt(match[4], 16) } : null;
}

function hexToRgbaString(hex) {
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return match ? `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${parseInt(match[4], 16) / 255})` : null;
}

function getStoredPaletteIndices() {
    // Ensure this function returns the correct indices for the current canvas state
    return storedPaletteIndices; // Make sure this is correctly populated elsewhere in your code
}

document.getElementById('color-indicators').addEventListener('click', function() {
    // Swap the primary and secondary colors
    [primaryColor, secondaryColor] = [secondaryColor, primaryColor];
    [primaryColorIndex, secondaryColorIndex] = [secondaryColorIndex, primaryColorIndex];

    // Update the color indicators to reflect the change
    updateColorIndicators();
});

function updateMonoPixelStates(monoBitmapData) {
    monoPixelStates = [];
    for (let i = 0; i < monoBitmapData.length; i++) {
        const byte = monoBitmapData[i];
        for (let bit = 0; bit < 8; bit++) {
            const isBlack = (byte & (1 << (7 - bit))) !== 0;
            monoPixelStates.push(isBlack);
        }
    }
}
