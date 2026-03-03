🚀 AMS System Fixes & Smart Mapping Implementation Guide
This document provides the complete source code and logic to fix the identified issues in the Asset Management System (AMS) and implement the sophisticated Excel Import Engine.

📂 Table of Contents
Prerequisites & Dependencies
Smart Mapping Engine (Backend)
Excel Import Service (Data Persistence)
Automatic Depreciation Logic
Frontend: Import Workflow & Mapping UI
Bug Fixes: Assets, Location, Export, Maintenance
1. Prerequisites & Dependencies
Run the following commands in your backend directory to install necessary libraries for Excel parsing, PDF generation, and fuzzy matching.

cd backendnpm install exceljs pdfkit fuzzy-search
2. Smart Mapping Engine (Backend)
This service uses a keyword dictionary and fuzzy matching to intelligently map Excel columns to system fields, solving the "Vast Keywords Mapping" requirement.

File: backend/services/SmartMappingService.js

javascript

    keywords: ['status', 'condition', 'state'],
    priority: 1
  },
  warrantyExpiry: {
    keywords: ['warranty', 'expiry', 'warranty date', 'expiration'],
    priority: 3
  }
};

class SmartMappingService {
  constructor() {
    this.dictionary = MAPPING_DICTIONARY;
  }

  /**
   * Main method: Takes Excel headers and returns a suggested mapping object.
   * @param {Array<string>} excelHeaders - Raw headers from the uploaded file
   * @returns {Object} - Mapping configuration { systemField: 'Excel Header' }
   */
  generateMapping(excelHeaders) {
    const suggestedMap = {};
    const cleanedHeaders = excelHeaders.map(h => this._cleanString(h));

    // Initialize FuzzySearch with the Excel headers
    const searcher = new FuzzySearch(cleanedHeaders, [], { caseSensitive: false, sort: true });

    for (const [systemField, config] of Object.entries(this.dictionary)) {
      let bestMatch = null;
      let bestScore = 0;

      // Try to find the best match for this system field among the headers
      for (const keyword of config.keywords) {
        const results = searcher.search(keyword);
        
        if (results.length > 0) {
          const topResult = results[0];
          const score = this._calculateSimilarity(keyword, topResult);

          // If this match is better than the previous one for this field, take it
          if (score > bestScore && score > 0.4) { // Threshold 0.4
            bestScore = score;
            bestMatch = excelHeaders[cleanedHeaders.indexOf(topResult)]; // Map back to original header
          }
        }
      }

      if (bestMatch) {
        suggestedMap[systemField] = bestMatch;
      }
    }

    return suggestedMap;
  }

  // Helper: Normalize string for comparison
  _cleanString(str) {
    if (!str) return "";
    return String(str).toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '');
  }

  // Helper: Simple similarity score
  _calculateSimilarity(str1, str2) {
    const s1 = this._cleanString(str1);
    const s2 = this._cleanString(str2);
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    return 0.6; // Default confidence for fuzzy matches
  }
}

module.exports = new SmartMappingService();
3. Excel Import Service (Data Persistence)
This service ensures data is actually inserted into the database. It handles "Upsert" logic for Brands/Suppliers and fixes the "Location not visible" issue.

File: backend/services/DataImportService.js

javascript

        let existingAsset = await Asset.findOne({ 
          serialNumber: assetData.serialNumber, 
          organization: orgId 
        });

        if (existingAsset) {
          stats.skipped++;
          continue; // Skip duplicate
        }

        // 5. Create Asset
        const newAsset = new Asset(assetData);
        await newAsset.save();

        // 6. Trigger Depreciation Generation (Fix for missing depreciation)
        await DepreciationService.generateSchedule(newAsset);

        stats.created++;

      } catch (err) {
        stats.errors.push({ row: rowIndex, message: err.message });
      }
    }

    return stats;
  }

  // Helper to safely get value by header name
  _getValue(row, key) {
    if (!key) return null;
    return row[key];
  }

  // Helper to find or create Brand
  async _upsertBrand(name, orgId) {
    if (!name) return null;
    return await Brand.findOneAndUpdate(
      { name: { $regex: new RegExp(`^${name}$`, 'i') }, organization: orgId },
      { $setOnInsert: { name, organization: orgId } },
      { upsert: true, new: true }
    );
  }

  // Helper to find or create Supplier
  async _upsertSupplier(name, email, orgId) {
    if (!name) return null;
    return await Supplier.findOneAndUpdate(
      { companyName: { $regex: new RegExp(`^${name}$`, 'i') }, organization: orgId },
      { $setOnInsert: { companyName: name, email: email || '', organization: orgId } },
      { upsert: true, new: true }
    );
  }

  // Helper to find or create Asset Type
  async _upsertAssetType(name, orgId) {
    if (!name) return null;
    return await AssetType.findOneAndUpdate(
      { name: { $regex: new RegExp(`^${name}$`, 'i') }, organization: orgId },
      { $setOnInsert: { name, organization: orgId } },
      { upsert: true, new: true }
    );
  }

  _parseDate(dateVal) {
    if (!dateVal) return new Date();
    // Handle Excel serial date numbers
    if (typeof dateVal === 'number') {
        return new Date((dateVal - 25569) * 86400 * 1000); 
    }
    return new Date(dateVal);
  }
}

module.exports = new DataImportService();
4. Automatic Depreciation Logic
This service automatically generates the depreciation schedule when an asset is created.

File: backend/services/DepreciationService.js

javascript

const DepreciationSchedule = require('../models/DepreciationSchedule');

class DepreciationService {
  async generateSchedule(asset) {
    try {
      const { _id, purchasePrice, purchaseDate, usefulLifeYears = 5, salvageValue = 0, organization } = asset;
      
      // Calculate Annual Depreciation (Straight Line Method)
      const annualDep = (purchasePrice - salvageValue) / usefulLifeYears;
      const monthlyDep = annualDep / 12;

      const schedule = [];
      let currentBookValue = purchasePrice;
      
      // Generate for the entire useful life (e.g., 5 years = 60 months)
      for (let m = 0; m < usefulLifeYears * 12; m++) {
        currentBookValue -= monthlyDep;
        if (currentBookValue < 0) currentBookValue = 0;

        const scheduleDate = new Date(purchaseDate);
        scheduleDate.setMonth(scheduleDate.getMonth() + m);

        schedule.push({
          asset: _id,
          organization: organization,
          date: scheduleDate,
          depreciationAmount: monthlyDep,
          bookValue: currentBookValue,
          method: 'STRAIGHT_LINE'
        });
      }

      await DepreciationSchedule.insertMany(schedule);
      console.log(`Generated depreciation schedule for Asset: ${asset.name}`);
    } catch (err) {
      console.error('Depreciation Generation Error:', err);
    }
  }
}

module.exports = DepreciationService;
5. Frontend: Import Workflow & Mapping UI
A React component that allows users to review and adjust the detected column mappings.

File: frontend/src/components/Import/MappingWizard.jsx

jsx

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SYSTEM_FIELDS = [
  { key: 'assetName', label: 'Asset Name' },
  { key: 'brand', label: 'Brand' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'assetType', label: 'Category/Type' },
  { key: 'serialNumber', label: 'Serial Number' },
  { key: 'purchasePrice', label: 'Purchase Price' },
  { key: 'purchaseDate', label: 'Purchase Date' },
  { key: 'location', label: 'Location/Branch' },
  { key: 'status', label: 'Status' }
];

export default function MappingWizard({ isOpen, onClose, rawHeaders, onConfirm }) {
  const [mapping, setMapping] = useState({});

  useEffect(() => {
    if (rawHeaders) {
      // Simple auto-map logic for initial load
      const initialMap = {};
      rawHeaders.forEach(header => {
        const lower = header.toLowerCase();
        if (lower.includes('name') && !initialMap.assetName) initialMap.assetName = header;
        if (lower.includes('brand')) initialMap.brand = header;
        if (lower.includes('supplier') || lower.includes('vendor')) initialMap.supplier = header;
        if (lower.includes('location') || lower.includes('branch')) initialMap.location = header;
      });
      setMapping(initialMap);
    }
  }, [rawHeaders]);

  const handleMapChange = (systemField, excelHeader) => {
    setMapping(prev => ({ ...prev, [systemField]: excelHeader }));
  };

  const submit = () => {
    onConfirm(mapping);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Map Excel Columns</DialogTitle>
          <p className="text-sm text-gray-500">Please verify or correct the column mapping.</p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-2 bg-gray-100 p-2 rounded font-semibold text-sm">
            <div>System Field</div>
            <div>Excel Column</div>
          </div>

          {SYSTEM_FIELDS.map(field => (
            <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
              <div className="font-medium text-gray-700">{field.label}</div>
              <Select 
                value={mapping[field.key] || ''} 
                onValueChange={(val) => handleMapChange(field.key, val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Column..." />
                </SelectTrigger>
                <SelectContent>
                  {rawHeaders?.map(h => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} className="bg-indigo-600 hover:bg-indigo-700">
            Confirm Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
6. Bug Fixes: Assets, Location, Export, Maintenance
A. Fix: Delete Selected Not Working
File: frontend/src/pages/Assets/AssetList.jsx

javascript

// Ensure you have access to the selected rows
const selectedRows = table.getSelectedRowModel().rows;

const handleBulkDelete = async () => {
  const ids = selectedRows.map(row => row.original._id);
  if (ids.length === 0) return;

  try {
    // Backend route needs to exist (see section 6B below)
    await apiClient.post('/assets/bulk-delete', { ids });
    toast({ title: "Deleted", description: `${ids.length} assets removed.` });
    refetch();
  } catch (err) {
    toast({ title: "Error", variant: "destructive" });
  }
};
B. Backend Route for Bulk Delete
File: backend/routes/assets.js

javascript

router.post('/bulk-delete', auth, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ msg: "Invalid IDs" });

  try {
    await Asset.deleteMany({ _id: { $in: ids }, organization: req.user.organization });
    res.json({ msg: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});
C. Fix: Export Options (PDF & Power BI)
File: backend/routes/reports.js

javascript

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// 1. Power BI Export (Clean Excel)
router.get('/export/powerbi', auth, async (req, res) => {
  const assets = await Asset.find({ organization: req.user.organization })
    .populate('brand', 'name')
    .populate('supplier', 'companyName')
    .lean();

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Assets');

  worksheet.columns = [
    { header: 'Asset Name', key: 'name' },
    { header: 'Brand', key: 'brand' },
    { header: 'Supplier', key: 'supplier' },
    { header: 'Location', key: 'location' },
    { header: 'Cost', key: 'purchasePrice' },
    { header: 'Status', key: 'status' },
  ];

  assets.forEach(a => {
    worksheet.addRow({
      ...a,
      brand: a.brand?.name || 'N/A',
      supplier: a.supplier?.companyName || 'N/A'
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="PowerBI_Data.xlsx"');
  
  await workbook.xlsx.write(res);
  res.end();
});

// 2. PDF Export
router.get('/export/pdf', auth, async (req, res) => {
  const assets = await Asset.find({ organization: req.user.organization }).lean();
  const doc = new PDFDocument({ margin: 30 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Asset_Report.pdf"');
  
  doc.pipe(res);
  doc.fontSize(20).text('Asset Report', { align: 'center' });
  doc.moveDown();

  assets.forEach(a => {
    doc.fontSize(10).text(`${a.name} | ${a.location} | $${a.purchasePrice}`);
  });

  doc.end();
});
D. Fix: Maintenance CRUD Backend
File: backend/routes/maintenance.js

javascript

const express = require('express');
const router = express.Router();
const Maintenance = require('../models/Maintenance');
const auth = require('../middleware/auth');

// Get All
router.get('/', auth, async (req, res) => {
  const logs = await Maintenance.find({ organization: req.user.organization })
    .populate('asset', 'name serialNumber');
  res.json(logs);
});

// Create
router.post('/', auth, async (req, res) => {
  const newLog = new Maintenance({ ...req.body, organization: req.user.organization });
  await newLog.save();
  res.json(newLog);
});

// Update
router.put('/:id', auth, async (req, res) => {
  const updated = await Maintenance.findOneAndUpdate(
    { _id: req.params.id, organization: req.user.organization },
    req.body,
    { new: true }
  );
  res.json(updated);
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  await Maintenance.findOneAndDelete({ _id: req.params.id, organization: req.user.organization });
  res.json({ msg: 'Deleted' });
});

module.exports = router;