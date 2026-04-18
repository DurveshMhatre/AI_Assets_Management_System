# 🚀 AMS-AI-System Enhancement Implementation Prompt

---

## 📋 PROJECT CONTEXT

```
Project Name: AMS-AI-System (Asset Management System with AI Features)
Repository: https://github.com/DurveshCoder/AMS-AI-System.git
Development Platform: Antigravity
Current Stack: TypeScript, Node.js/Express, React/Next.js, PostgreSQL 15, Redis 7, Docker
Current Status: Active Development - Core features implemented, needs enhancement
```

---

## 🎯 IMPLEMENTATION OBJECTIVE

Transform the current Excel import mapping mechanism from **static keyword-based matching** to a **dynamic, learning-enabled, context-aware intelligent mapping system**. Additionally, implement **automatic depreciation calculation with interactive visualization charts** in the asset details page.

---

## 📦 FEATURE 1: INTELLIGENT DYNAMIC COLUMN MAPPING SYSTEM

### 1.1 Current State Analysis

```
Location: backend/services/SmartMappingService.js
Current Approach: Static keyword dictionary + basic fuzzy matching
Limitations:
  ❌ No learning from user corrections
  ❌ No organization-specific pattern memory
  ❌ Fixed confidence threshold (0.4) for all fields
  ❌ No user involvement in mapping refinement
  ❌ Equal priority for all fields (no "narrow vision")
```

### 1.2 Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DYNAMIC MAPPING ENGINE                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │   Keyword   │  │  Organization│  │   User Feedback     │    │
│  │  Dictionary │  │   Patterns   │  │   Learning Loop     │    │
│  │  (Base)     │  │   (Per-Org)  │  │   (Continuous)      │    │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘    │
│         │                │                      │               │
│         └────────────────┼──────────────────────┘               │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │   Weighted Scoring    │                          │
│              │   Engine (Dynamic)    │                          │
│              └───────────┬───────────┘                          │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │   Confidence Output   │                          │
│              │   + Mapping Suggestion│                          │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Database Schema Additions

```sql
-- NEW TABLE: Store mapping feedback for learning
CREATE TABLE mapping_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  excel_header_original VARCHAR(255) NOT NULL,
  excel_header_normalized VARCHAR(255) NOT NULL,
  mapped_system_field VARCHAR(100) NOT NULL,
  was_correct BOOLEAN NOT NULL,
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_org_header (organization_id, excel_header_normalized),
  INDEX idx_field (mapped_system_field)
);

-- NEW TABLE: Store organization-specific mapping patterns
CREATE TABLE org_mapping_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  excel_header_normalized VARCHAR(255) NOT NULL,
  system_field VARCHAR(100) NOT NULL,
  usage_count INTEGER DEFAULT 1,
  success_rate DECIMAL(3,2) DEFAULT 1.0,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(organization_id, excel_header_normalized, system_field),
  INDEX idx_org_pattern (organization_id, success_rate DESC)
);

-- MODIFY: Add mapping confidence to import logs
ALTER TABLE import_logs 
ADD COLUMN mapping_confidence_avg DECIMAL(3,2),
ADD COLUMN mapping_required_manual BOOLEAN DEFAULT FALSE;
```

### 1.4 Backend Implementation Specifications

#### File: `backend/services/SmartMappingService.js`

```javascript
/**
 * ENHANCED SmartMappingService with Dynamic Learning
 * 
 * Key Improvements:
 * 1. Organization-specific pattern memory
 * 2. Weighted confidence scoring with field priorities
 * 3. User feedback integration for continuous learning
 * 4. Narrow vision mode for critical fields
 * 5. Context-aware similarity calculation
 */

const { Pool } = require('pg');
const { fuzzyMatch } = require('fuzzy-search');

class SmartMappingService {
  constructor(dbPool) {
    this.db = dbPool;
    this.mappingDictionary = this._initializeDictionary();
    this.orgPatternCache = new Map(); // In-memory cache for org patterns
  }

  /**
   * Initialize mapping dictionary with field priorities
   * Priority: 1 (Highest) to 5 (Lowest)
   */
  _initializeDictionary() {
    return {
      assetName: { 
        keywords: ['name', 'asset', 'item', 'description', 'title'], 
        priority: 1, 
        required: true,
        narrowVision: true 
      },
      serialNumber: { 
        keywords: ['serial', 'sn', 's/n', 'id', 'identifier', 'code'], 
        priority: 1, 
        required: true,
        narrowVision: true 
      },
      brand: { 
        keywords: ['brand', 'manufacturer', 'make', 'vendor', 'company'], 
        priority: 2, 
        required: false 
      },
      supplier: { 
        keywords: ['supplier', 'vendor', 'seller', 'provider', 'source'], 
        priority: 2, 
        required: false 
      },
      category: { 
        keywords: ['category', 'type', 'class', 'group', 'classification'], 
        priority: 2, 
        required: false 
      },
      purchasePrice: { 
        keywords: ['price', 'cost', 'amount', 'value', 'purchase'], 
        priority: 1, 
        required: true,
        narrowVision: true,
        dataType: 'currency' 
      },
      purchaseDate: { 
        keywords: ['date', 'purchase', 'acquired', 'bought'], 
        priority: 1, 
        required: true,
        narrowVision: true,
        dataType: 'date' 
      },
      location: { 
        keywords: ['location', 'place', 'site', 'branch', 'office', 'department'], 
        priority: 3, 
        required: false 
      },
      status: { 
        keywords: ['status', 'condition', 'state', 'active'], 
        priority: 3, 
        required: false 
      },
      salvageValue: { 
        keywords: ['salvage', 'residual', 'scrap', 'end'], 
        priority: 4, 
        required: false,
        dataType: 'currency' 
      },
      usefulLife: { 
        keywords: ['life', 'years', 'duration', 'period'], 
        priority: 4, 
        required: false,
        dataType: 'number' 
      }
    };
  }

  /**
   * Normalize Excel header for consistent matching
   */
  _normalizeHeader(header) {
    return header
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
  }

  /**
   * Context-aware similarity calculation with multiple factors
   */
  _calculateSimilarity(excelHeader, systemField, orgId) {
    const fieldConfig = this.mappingDictionary[systemField];
    if (!fieldConfig) return 0;

    const normalizedExcel = this._normalizeHeader(excelHeader);
    let baseScore = 0;

    // Factor 1: Exact keyword match (highest weight)
    for (const keyword of fieldConfig.keywords) {
      if (normalizedExcel === keyword) {
        baseScore = Math.max(baseScore, 0.95);
      } else if (normalizedExcel.includes(keyword) || keyword.includes(normalizedExcel)) {
        baseScore = Math.max(baseScore, 0.8);
      }
    }

    // Factor 2: Fuzzy matching for partial matches
    if (baseScore < 0.8) {
      const fuzzyScore = fuzzyMatch(excelHeader, fieldConfig.keywords.join(' '));
      baseScore = Math.max(baseScore, fuzzyScore * 0.7);
    }

    // Factor 3: Organization pattern boost (learned mappings)
    const orgBoost = this._getOrgPatternBoost(orgId, normalizedExcel, systemField);
    baseScore = Math.min(1.0, baseScore + orgBoost);

    // Factor 4: Priority weighting (critical fields get threshold boost)
    const priorityWeight = (6 - fieldConfig.priority) / 5; // Priority 1 = 1.0, Priority 5 = 0.2
    baseScore = baseScore * (0.7 + 0.3 * priorityWeight);

    // Factor 5: Narrow vision penalty for non-critical matches on critical fields
    if (fieldConfig.narrowVision && baseScore < 0.7) {
      baseScore = baseScore * 0.8; // Reduce confidence for uncertain critical field matches
    }

    return Math.round(baseScore * 100) / 100;
  }

  /**
   * Get organization-specific pattern boost from cache or database
   */
  async _getOrgPatternBoost(orgId, excelHeader, systemField) {
    const cacheKey = `${orgId}:${excelHeader}`;
    
    // Check in-memory cache first
    if (this.orgPatternCache.has(cacheKey)) {
      const pattern = this.orgPatternCache.get(cacheKey);
      if (pattern.system_field === systemField) {
        return pattern.success_rate * 0.15; // Max 15% boost
      }
    }

    // Query database for organization patterns
    try {
      const result = await this.db.query(
        `SELECT system_field, success_rate, usage_count 
         FROM org_mapping_patterns 
         WHERE organization_id = $1 AND excel_header_normalized = $2 
         ORDER BY success_rate DESC, usage_count DESC 
         LIMIT 1`,
        [orgId, excelHeader]
      );

      if (result.rows.length > 0) {
        const pattern = result.rows[0];
        this.orgPatternCache.set(cacheKey, pattern);
        
        if (pattern.system_field === systemField) {
          return pattern.success_rate * 0.15;
        }
      }
    } catch (error) {
      console.error('Error fetching org patterns:', error);
    }

    return 0;
  }

  /**
   * Generate mapping suggestions with confidence scores
   * 
   * @param {string[]} excelHeaders - Array of Excel column headers
   * @param {string} orgId - Organization ID for pattern learning
   * @param {Object} options - Configuration options
   * @param {boolean} options.strictMode - Enable narrow vision (higher thresholds)
   * @param {number} options.minConfidence - Minimum confidence threshold (default: 0.4)
   * @returns {Object} Mapping suggestions with confidence scores
   */
  async generateMapping(excelHeaders, orgId, options = {}) {
    const { 
      strictMode = false, 
      minConfidence = 0.4,
      requireConfirmationBelow = 0.7
    } = options;

    const mappingResult = {
      suggestions: {},
      unmappedHeaders: [],
      unmappedFields: [],
      requiresManualReview: false,
      averageConfidence: 0,
      fieldConfidenceScores: {}
    };

    const usedHeaders = new Set();
    const confidenceScores = [];

    // Process each system field in priority order
    const sortedFields = Object.entries(this.mappingDictionary)
      .sort((a, b) => a[1].priority - b[1].priority);

    for (const [systemField, config] of sortedFields) {
      let bestMatch = null;
      let bestScore = 0;
      let bestHeader = null;

      // Find best matching Excel header for this system field
      for (const header of excelHeaders) {
        if (usedHeaders.has(header)) continue;

        const score = await this._calculateSimilarity(header, systemField, orgId);
        
        // Apply strict mode threshold for narrow vision fields
        const effectiveThreshold = (strictMode && config.narrowVision) 
          ? Math.max(minConfidence, 0.7) 
          : minConfidence;

        if (score > bestScore && score >= effectiveThreshold) {
          bestScore = score;
          bestMatch = systemField;
          bestHeader = header;
        }
      }

      if (bestMatch) {
        mappingResult.suggestions[bestMatch] = bestHeader;
        mappingResult.fieldConfidenceScores[bestMatch] = bestScore;
        confidenceScores.push(bestScore);
        usedHeaders.add(bestHeader);

        // Flag for manual review if confidence is below threshold
        if (bestScore < requireConfirmationBelow) {
          mappingResult.requiresManualReview = true;
        }
      } else if (config.required) {
        mappingResult.unmappedFields.push(systemField);
        mappingResult.requiresManualReview = true;
      }
    }

    // Track unmapped Excel headers
    mappingResult.unmappedHeaders = excelHeaders.filter(h => !usedHeaders.has(h));

    // Calculate average confidence
    mappingResult.averageConfidence = confidenceScores.length > 0
      ? Math.round((confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length) * 100) / 100
      : 0;

    return mappingResult;
  }

  /**
   * Record user feedback for continuous learning
   * 
   * @param {Object} feedbackData - Feedback information
   * @param {string} feedbackData.orgId - Organization ID
   * @param {string} feedbackData.excelHeader - Original Excel header
   * @param {string} feedbackData.systemField - Mapped system field
   * @param {boolean} feedbackData.wasCorrect - User confirmed correctness
   * @param {number} feedbackData.confidenceScore - Original confidence score
   */
  async recordFeedback(feedbackData) {
    const { orgId, excelHeader, systemField, wasCorrect, confidenceScore } = feedbackData;
    const normalizedHeader = this._normalizeHeader(excelHeader);

    try {
      // Insert feedback record
      await this.db.query(
        `INSERT INTO mapping_feedback 
         (organization_id, excel_header_original, excel_header_normalized, 
          mapped_system_field, was_correct, confidence_score)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orgId, excelHeader, normalizedHeader, systemField, wasCorrect, confidenceScore]
      );

      // Update or create organization pattern
      await this.db.query(
        `INSERT INTO org_mapping_patterns 
         (organization_id, excel_header_normalized, system_field, 
          usage_count, success_rate, last_used_at)
         VALUES ($1, $2, $3, 1, $4, NOW())
         ON CONFLICT (organization_id, excel_header_normalized, system_field)
         DO UPDATE SET
           usage_count = org_mapping_patterns.usage_count + 1,
           success_rate = (
             (org_mapping_patterns.success_rate * org_mapping_patterns.usage_count) + 
             (CASE WHEN $5 THEN 1 ELSE 0 END)
           ) / (org_mapping_patterns.usage_count + 1),
           last_used_at = NOW()`,
        [orgId, normalizedHeader, systemField, wasCorrect ? 1 : 0, wasCorrect]
      );

      // Invalidate cache for this pattern
      const cacheKey = `${orgId}:${normalizedHeader}`;
      this.orgPatternCache.delete(cacheKey);

      return { success: true, message: 'Feedback recorded successfully' };
    } catch (error) {
      console.error('Error recording feedback:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get mapping statistics for an organization
   */
  async getMappingStats(orgId) {
    const result = await this.db.query(
      `SELECT 
         COUNT(*) as total_feedbacks,
         COUNT(CASE WHEN was_correct = true THEN 1 END) as correct_mappings,
         ROUND(AVG(confidence_score)::numeric, 2) as avg_confidence,
         ROUND((COUNT(CASE WHEN was_correct = true THEN 1 END)::numeric / COUNT(*) * 100), 2) as accuracy_rate
       FROM mapping_feedback
       WHERE organization_id = $1`,
      [orgId]
    );

    return result.rows[0];
  }
}

module.exports = SmartMappingService;
```

#### File: `backend/routes/import.js`

```javascript
const express = require('express');
const router = express.Router();
const SmartMappingService = require('../services/SmartMappingService');
const DataImportService = require('../services/DataImportService');
const authMiddleware = require('../middleware/auth');
const { pool } = require('../config/database');

const smartMappingService = new SmartMappingService(pool);

/**
 * POST /api/import/analyze
 * Analyze Excel file and generate mapping suggestions
 */
router.post('/analyze', authMiddleware, async (req, res) => {
  try {
    const { headers, orgId } = req.body;
    
    if (!headers || !Array.isArray(headers)) {
      return res.status(400).json({ error: 'Headers array is required' });
    }

    const mappingResult = await smartMappingService.generateMapping(headers, orgId, {
      strictMode: req.query.strict === 'true',
      minConfidence: parseFloat(req.query.minConfidence) || 0.4
    });

    res.json({
      success: true,
       mappingResult
    });
  } catch (error) {
    console.error('Error analyzing import:', error);
    res.status(500).json({ error: 'Failed to analyze import file' });
  }
});

/**
 * POST /api/import/feedback
 * Record user feedback on mapping accuracy
 */
router.post('/feedback', authMiddleware, async (req, res) => {
  try {
    const { mappings, orgId } = req.body;
    // mappings: [{ excelHeader, systemField, wasCorrect, confidenceScore }]

    const results = [];
    for (const mapping of mappings) {
      const result = await smartMappingService.recordFeedback({
        orgId,
        excelHeader: mapping.excelHeader,
        systemField: mapping.systemField,
        wasCorrect: mapping.wasCorrect,
        confidenceScore: mapping.confidenceScore
      });
      results.push(result);
    }

    res.json({
      success: true,
      message: 'Feedback recorded successfully',
      results
    });
  } catch (error) {
    console.error('Error recording feedback:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

/**
 * GET /api/import/stats
 * Get mapping statistics for organization
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const stats = await smartMappingService.getMappingStats(orgId);
    
    res.json({
      success: true,
       stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
```

---

### 1.5 Frontend Implementation Specifications

#### File: `frontend/components/import/MappingWizard.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Brain } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Intelligent Mapping Wizard Component
 * 
 * Features:
 * - Display confidence scores for each mapping
 * - Allow manual override of automatic mappings
 * - Collect user feedback for learning
 * - Show unmapped fields requiring attention
 * - Display organization mapping accuracy stats
 */
export default function MappingWizard({ 
  isOpen, 
  onClose, 
  excelHeaders, 
  onConfirm, 
  orgId,
  fileName 
}) {
  const [loading, setLoading] = useState(true);
  const [mappingResult, setMappingResult] = useState(null);
  const [userMappings, setUserMappings] = useState({});
  const [feedback, setFeedback] = useState({});
  const [stats, setStats] = useState(null);

  // System fields that need mapping
  const SYSTEM_FIELDS = [
    { key: 'assetName', label: 'Asset Name', required: true, narrowVision: true },
    { key: 'serialNumber', label: 'Serial Number', required: true, narrowVision: true },
    { key: 'brand', label: 'Brand/Manufacturer', required: false },
    { key: 'supplier', label: 'Supplier', required: false },
    { key: 'category', label: 'Category', required: false },
    { key: 'purchasePrice', label: 'Purchase Price', required: true, narrowVision: true },
    { key: 'purchaseDate', label: 'Purchase Date', required: true, narrowVision: true },
    { key: 'location', label: 'Location/Branch', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'salvageValue', label: 'Salvage Value', required: false },
    { key: 'usefulLife', label: 'Useful Life (Years)', required: false }
  ];

  useEffect(() => {
    if (isOpen && excelHeaders) {
      loadMappingSuggestions();
      loadOrgStats();
    }
  }, [isOpen, excelHeaders, orgId]);

  const loadMappingSuggestions = async () => {
    setLoading(true);
    try {
      const response = await api.post('/import/analyze', {
        headers: excelHeaders,
        orgId
      });
      
      setMappingResult(response.data);
      setUserMappings(response.data.data.suggestions);
    } catch (error) {
      console.error('Failed to load mapping suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgStats = async () => {
    try {
      const response = await api.get('/import/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleMappingChange = (systemField, excelHeader) => {
    setUserMappings(prev => ({
      ...prev,
      [systemField]: excelHeader
    }));
  };

  const handleFeedbackToggle = (systemField, isCorrect) => {
    const excelHeader = userMappings[systemField];
    const confidenceScore = mappingResult?.data?.fieldConfidenceScores?.[systemField] || 0;

    setFeedback(prev => ({
      ...prev,
      [systemField]: {
        excelHeader,
        systemField,
        wasCorrect: isCorrect,
        confidenceScore
      }
    }));
  };

  const getConfidenceBadge = (systemField) => {
    const score = mappingResult?.data?.fieldConfidenceScores?.[systemField] || 0;
    
    if (score >= 0.8) {
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {Math.round(score * 100)}%
        </Badge>
      );
    } else if (score >= 0.5) {
      return (
        <Badge variant="warning" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          {Math.round(score * 100)}%
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          {Math.round(score * 100)}%
        </Badge>
      );
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    const missingRequired = SYSTEM_FIELDS
      .filter(f => f.required && !userMappings[f.key])
      .map(f => f.label);

    if (missingRequired.length > 0) {
      alert(`Please map all required fields: ${missingRequired.join(', ')}`);
      return;
    }

    // Submit feedback for learning
    const feedbackArray = Object.values(feedback);
    if (feedbackArray.length > 0) {
      await api.post('/import/feedback', {
        mappings: feedbackArray,
        orgId
      });
    }

    // Confirm mappings and proceed with import
    onConfirm(userMappings);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Brain className="w-6 h-6" />
                Intelligent Mapping Wizard
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                File: {fileName} | {excelHeaders?.length} columns detected
              </p>
            </div>
            {stats && (
              <div className="text-right text-sm">
                <p className="text-blue-100">Your Mapping Accuracy</p>
                <p className="text-2xl font-bold">{stats.accuracy_rate || 0}%</p>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Analyzing columns...</span>
            </div>
          ) : (
            <>
              {/* Overall Confidence Alert */}
              {mappingResult?.data && (
                <Alert className={`mb-6 ${
                  mappingResult.data.averageConfidence >= 0.7 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <AlertDescription className="flex items-center justify-between">
                    <span>
                      Overall Mapping Confidence: <strong>{Math.round(mappingResult.data.averageConfidence * 100)}%</strong>
                    </span>
                    <Progress value={mappingResult.data.averageConfidence * 100} className="w-32" />
                  </AlertDescription>
                </Alert>
              )}

              {/* Mapping Rows */}
              <div className="space-y-4">
                {SYSTEM_FIELDS.map((field) => (
                  <div 
                    key={field.key} 
                    className={`p-4 rounded-lg border ${
                      field.required ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-medium text-gray-900">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                        {field.narrowVision && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Critical Field
                          </Badge>
                        )}
                      </label>
                      {userMappings[field.key] && getConfidenceBadge(field.key)}
                    </div>

                    <div className="flex gap-3">
                      <Select
                        value={userMappings[field.key] || ''}
                        onValueChange={(val) => handleMappingChange(field.key, val)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select Excel column..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— Don't map this field —</SelectItem>
                          {excelHeaders?.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {userMappings[field.key] && (
                        <div className="flex gap-2">
                          <Button
                            variant={feedback[field.key]?.wasCorrect ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleFeedbackToggle(field.key, true)}
                            className={feedback[field.key]?.wasCorrect ? 'bg-green-600' : ''}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Correct
                          </Button>
                          <Button
                            variant={feedback[field.key]?.wasCorrect === false ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => handleFeedbackToggle(field.key, false)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Wrong
                          </Button>
                        </div>
                      )}
                    </div>

                    {mappingResult?.data?.unmappedFields?.includes(field.key) && (
                      <p className="text-red-500 text-sm mt-2">
                        ⚠️ No suitable column found for this required field
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Unmapped Headers Warning */}
              {mappingResult?.data?.unmappedHeaders?.length > 0 && (
                <Alert className="mt-6 bg-gray-50">
                  <AlertTriangle className="w-4 h-4 text-gray-600" />
                  <AlertDescription>
                    <strong>{mappingResult.data.unmappedHeaders.length}</strong> Excel columns 
                    will not be imported: {mappingResult.data.unmappedHeaders.join(', ')}
                  </AlertDescription>
                </Alert>
              )}

              {/* Manual Review Required */}
              {mappingResult?.data?.requiresManualReview && (
                <Alert className="mt-4 bg-yellow-50 border-yellow-300">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    Some mappings have low confidence. Please review and confirm before proceeding.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>

        <CardFooter className="border-t p-6 flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={loadMappingSuggestions} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Re-analyze
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || mappingResult?.data?.unmappedFields?.length > 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirm & Import
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
```

---

## 📦 FEATURE 2: AUTOMATIC DEPRECIATION WITH VISUALIZATION CHARTS

### 2.1 Current State Analysis

```
Location: backend/services/DepreciationService.js
Current Approach: Straight-line method, schedule generated on asset creation
Limitations:
  ❌ Only supports straight-line depreciation
  ❌ No chart visualization in frontend
  ❌ No method selection for users
  ❌ No real-time depreciation status display
```

### 2.2 Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  DEPRECIATION ENGINE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │ Asset Creation  │────▶│ Depreciation    │                   │
│  │ / Update        │     │ Schedule Gen    │                   │
│  └─────────────────┘     └────────┬────────┘                   │
│                                   │                             │
│                                   ▼                             │
│                        ┌─────────────────────┐                  │
│                        │ DepreciationSchedule│                  │
│                        │ (PostgreSQL Table)  │                  │
│                        └─────────┬───────────┘                  │
│                                  │                              │
│         ┌────────────────────────┼────────────────────────┐     │
│         │                        │                        │     │
│         ▼                        ▼                        ▼     │
│  ┌─────────────┐         ┌─────────────┐          ┌──────────┐ │
│  │ Chart API   │         │ Status API  │          │ Report   │ │
│  │ Endpoint    │         │ Endpoint    │          │ Export   │ │
│  └─────────────┘         └─────────────┘          └──────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Database Schema Additions

```sql
-- MODIFY: Add depreciation method to assets table
ALTER TABLE assets 
ADD COLUMN depreciation_method VARCHAR(50) DEFAULT 'STRAIGHT_LINE',
ADD COLUMN depreciation_start_date DATE,
ADD COLUMN last_depreciation_calc DATE;

-- ADD: Depreciation methods enum
CREATE TYPE depreciation_method_enum AS ENUM (
  'STRAIGHT_LINE',
  'DECLINING_BALANCE',
  'SUM_OF_YEARS_DIGITS',
  'UNITS_OF_PRODUCTION'
);

-- NEW TABLE: Depreciation calculation logs for audit
CREATE TABLE depreciation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  calculation_date DATE NOT NULL,
  method_used VARCHAR(50) NOT NULL,
  opening_book_value DECIMAL(12,2) NOT NULL,
  depreciation_amount DECIMAL(12,2) NOT NULL,
  closing_book_value DECIMAL(12,2) NOT NULL,
  calculated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_asset_date (asset_id, calculation_date)
);
```

### 2.4 Backend Implementation Specifications

#### File: `backend/services/DepreciationService.js`

```javascript
/**
 * Enhanced DepreciationService with Multiple Methods
 * 
 * Supported Methods:
 * 1. STRAIGHT_LINE - Equal depreciation each period
 * 2. DECLINING_BALANCE - Higher depreciation in early years
 * 3. SUM_OF_YEARS_DIGITS - Accelerated depreciation
 */

const { Pool } = require('pg');

class DepreciationService {
  constructor(dbPool) {
    this.db = dbPool;
  }

  /**
   * Calculate straight-line depreciation
   * Formula: (Cost - Salvage) / Useful Life
   */
  _calculateStraightLine(asset) {
    const { purchasePrice, salvageValue, usefulLifeYears } = asset;
    const depreciableAmount = purchasePrice - salvageValue;
    const annualDepreciation = depreciableAmount / usefulLifeYears;
    const monthlyDepreciation = annualDepreciation / 12;

    return {
      method: 'STRAIGHT_LINE',
      annualDepreciation,
      monthlyDepreciation,
      depreciableAmount,
      totalDepreciableMonths: usefulLifeYears * 12
    };
  }

  /**
   * Calculate declining balance depreciation
   * Formula: Book Value × Depreciation Rate
   * Rate = (1 / Useful Life) × Multiplier (typically 2 for double-declining)
   */
  _calculateDecliningBalance(asset, multiplier = 2) {
    const { purchasePrice, salvageValue, usefulLifeYears } = asset;
    const straightLineRate = 1 / usefulLifeYears;
    const decliningRate = straightLineRate * multiplier;

    let bookValue = purchasePrice;
    const schedule = [];
    let totalDepreciation = 0;

    for (let year = 1; year <= usefulLifeYears; year++) {
      const annualDep = bookValue * decliningRate;
      
      // Ensure we don't depreciate below salvage value
      const adjustedDep = Math.min(annualDep, bookValue - salvageValue);
      
      bookValue -= adjustedDep;
      totalDepreciation += adjustedDep;

      schedule.push({
        year,
        depreciation: adjustedDep,
        bookValue: Math.max(bookValue, salvageValue),
        accumulatedDepreciation: totalDepreciation
      });

      if (bookValue <= salvageValue) break;
    }

    return {
      method: 'DECLINING_BALANCE',
      multiplier,
      decliningRate,
      schedule
    };
  }

  /**
   * Calculate sum-of-years-digits depreciation
   * Formula: (Remaining Life / SYD) × Depreciable Amount
   * SYD = n(n+1)/2 where n = useful life
   */
  _calculateSumOfYearsDigits(asset) {
    const { purchasePrice, salvageValue, usefulLifeYears } = asset;
    const depreciableAmount = purchasePrice - salvageValue;
    const syd = (usefulLifeYears * (usefulLifeYears + 1)) / 2;

    let schedule = [];
    let accumulatedDepreciation = 0;

    for (let year = 1; year <= usefulLifeYears; year++) {
      const remainingLife = usefulLifeYears - year + 1;
      const annualDep = (remainingLife / syd) * depreciableAmount;
      accumulatedDepreciation += annualDep;

      schedule.push({
        year,
        depreciation: annualDep,
        bookValue: purchasePrice - accumulatedDepreciation,
        accumulatedDepreciation
      });
    }

    return {
      method: 'SUM_OF_YEARS_DIGITS',
      syd,
      schedule
    };
  }

  /**
   * Generate complete depreciation schedule for an asset
   */
  async generateSchedule(asset, method = 'STRAIGHT_LINE') {
    const calculations = {
      STRAIGHT_LINE: () => this._calculateStraightLine(asset),
      DECLINING_BALANCE: () => this._calculateDecliningBalance(asset),
      SUM_OF_YEARS_DIGITS: () => this._calculateSumOfYearsDigits(asset)
    };

    const calculation = calculations[method]?.() || calculations.STRAIGHT_LINE();

    // Generate monthly schedule entries
    const schedule = [];
    const startDate = new Date(asset.purchaseDate || asset.depreciationStartDate || new Date());
    let bookValue = asset.purchasePrice;
    let accumulatedDepreciation = 0;

    const totalMonths = method === 'STRAIGHT_LINE' 
      ? calculation.totalDepreciableMonths 
      : asset.usefulLifeYears * 12;

    for (let month = 0; month < totalMonths; month++) {
      const currentDate = new Date(startDate);
      currentDate.setMonth(startDate.getMonth() + month);

      let monthlyDep = 0;
      
      if (method === 'STRAIGHT_LINE') {
        monthlyDep = calculation.monthlyDepreciation;
      } else if (calculation.schedule) {
        // For other methods, distribute annual depreciation monthly
        const yearIndex = Math.floor(month / 12);
        if (calculation.schedule[yearIndex]) {
          monthlyDep = calculation.schedule[yearIndex].depreciation / 12;
        }
      }

      // Ensure book value doesn't go below salvage
      const adjustedDep = Math.min(monthlyDep, bookValue - asset.salvageValue);
      bookValue -= adjustedDep;
      accumulatedDepreciation += adjustedDep;

      if (bookValue <= asset.salvageValue) {
        bookValue = asset.salvageValue;
      }

      schedule.push({
        assetId: asset.id,
        date: currentDate,
        depreciationAmount: adjustedDep,
        bookValue,
        accumulatedDepreciation,
        method
      });

      if (bookValue <= asset.salvageValue) break;
    }

    return {
      ...calculation,
      schedule,
      finalBookValue: bookValue,
      totalDepreciation: accumulatedDepreciation
    };
  }

  /**
   * Save depreciation schedule to database
   */
  async saveSchedule(assetId, scheduleData, userId) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Clear existing schedule
      await client.query(
        'DELETE FROM depreciation_schedule WHERE asset_id = $1',
        [assetId]
      );

      // Insert new schedule entries
      for (const entry of scheduleData.schedule) {
        await client.query(
          `INSERT INTO depreciation_schedule 
           (asset_id, date, depreciation_amount, book_value, accumulated_depreciation, method)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [assetId, entry.date, entry.depreciationAmount, entry.bookValue, 
           entry.accumulatedDepreciation, entry.method]
        );
      }

      // Update asset with depreciation info
      await client.query(
        `UPDATE assets 
         SET current_book_value = $1, 
             total_depreciated = $2,
             depreciation_method = $3,
             last_depreciation_calc = NOW()
         WHERE id = $4`,
        [scheduleData.finalBookValue, scheduleData.totalDepreciation, 
         scheduleData.method, assetId]
      );

      // Log the calculation
      await client.query(
        `INSERT INTO depreciation_logs 
         (asset_id, calculation_date, method_used, opening_book_value, 
          depreciation_amount, closing_book_value, calculated_by)
         VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
        [assetId, scheduleData.method, asset.purchasePrice, 
         scheduleData.totalDepreciation, scheduleData.finalBookValue, userId]
      );

      await client.query('COMMIT');
      return { success: true, scheduleData };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error saving depreciation schedule:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  /**
   * Get chart-ready data for frontend visualization
   */
  async getChartData(assetId, orgId) {
    const result = await this.db.query(
      `SELECT 
         ds.date,
         ds.book_value,
         ds.accumulated_depreciation,
         ds.depreciation_amount,
         ds.method,
         a.purchase_price,
         a.salvage_value,
         a.useful_life_years
       FROM depreciation_schedule ds
       JOIN assets a ON ds.asset_id = a.id
       WHERE ds.asset_id = $1 AND a.organization_id = $2
       ORDER BY ds.date ASC`,
      [assetId, orgId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const asset = result.rows[0];
    const labels = result.rows.map(r => 
      new Date(r.date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      })
    );

    return {
      labels,
      datasets: [
        {
          label: 'Book Value',
           result.rows.map(r => parseFloat(r.book_value)),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Accumulated Depreciation',
           result.rows.map(r => parseFloat(r.accumulated_depreciation)),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          borderDash: [5, 5],
          tension: 0.4
        }
      ],
      meta {
        purchasePrice: parseFloat(asset.purchase_price),
        salvageValue: parseFloat(asset.salvage_value),
        usefulLifeYears: asset.useful_life_years,
        method: asset.method,
        currentValue: parseFloat(result.rows[result.rows.length - 1]?.book_value || 0),
        totalDepreciated: parseFloat(result.rows[result.rows.length - 1]?.accumulated_depreciation || 0)
      }
    };
  }

  /**
   * Get current depreciation status summary
   */
  async getStatusSummary(assetId, orgId) {
    const result = await this.db.query(
      `SELECT 
         a.id,
         a.asset_name,
         a.purchase_price,
         a.salvage_value,
         a.current_book_value,
         a.total_depreciated,
         a.depreciation_method,
         a.purchase_date,
         a.useful_life_years,
         ds.date as last_calculation_date,
         ds.book_value as current_value
       FROM assets a
       LEFT JOIN LATERAL (
         SELECT date, book_value 
         FROM depreciation_schedule 
         WHERE asset_id = a.id 
         ORDER BY date DESC 
         LIMIT 1
       ) ds ON true
       WHERE a.id = $1 AND a.organization_id = $2`,
      [assetId, orgId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const asset = result.rows[0];
    const remainingValue = parseFloat(asset.current_value || asset.current_book_value);
    const totalDepreciated = parseFloat(asset.total_depreciated || 0);
    const purchasePrice = parseFloat(asset.purchase_price);

    // Calculate remaining useful life
    const purchaseDate = new Date(asset.purchase_date);
    const today = new Date();
    const monthsElapsed = (today.getFullYear() - purchaseDate.getFullYear()) * 12 + 
                          (today.getMonth() - purchaseDate.getMonth());
    const totalMonths = asset.useful_life_years * 12;
    const remainingMonths = Math.max(0, totalMonths - monthsElapsed);

    return {
      assetId: asset.id,
      assetName: asset.asset_name,
      purchasePrice,
      currentBookValue: remainingValue,
      totalDepreciated,
      depreciationMethod: asset.depreciation_method,
      depreciationPercentage: Math.round((totalDepreciated / purchasePrice) * 100),
      remainingMonths,
      remainingYears: Math.round(remainingMonths / 12 * 10) / 10,
      isFullyDepreciated: remainingValue <= parseFloat(asset.salvage_value),
      lastCalculationDate: asset.last_calculation_date
    };
  }
}

module.exports = DepreciationService;
```

#### File: `backend/routes/assets.js`

```javascript
const express = require('express');
const router = express.Router();
const DepreciationService = require('../services/DepreciationService');
const authMiddleware = require('../middleware/auth');
const { pool } = require('../config/database');

const depreciationService = new DepreciationService(pool);

/**
 * GET /api/assets/:id/depreciation-chart
 * Get chart-ready depreciation data for an asset
 */
router.get('/:id/depreciation-chart', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organizationId;

    const chartData = await depreciationService.getChartData(id, orgId);

    if (!chartData) {
      return res.status(404).json({ 
        error: 'No depreciation data found for this asset' 
      });
    }

    res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    console.error('Error fetching depreciation chart:', error);
    res.status(500).json({ error: 'Failed to fetch depreciation data' });
  }
});

/**
 * GET /api/assets/:id/depreciation-status
 * Get current depreciation status summary
 */
router.get('/:id/depreciation-status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organizationId;

    const status = await depreciationService.getStatusSummary(id, orgId);

    if (!status) {
      return res.status(404).json({ 
        error: 'Asset not found or no depreciation data' 
      });
    }

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching depreciation status:', error);
    res.status(500).json({ error: 'Failed to fetch depreciation status' });
  }
});

/**
 * POST /api/assets/:id/recalculate-depreciation
 * Recalculate depreciation with new method or parameters
 */
router.post('/:id/recalculate-depreciation', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { method, usefulLifeYears, salvageValue } = req.body;
    const userId = req.user.id;

    // Fetch current asset data
    const assetResult = await pool.query(
      'SELECT * FROM assets WHERE id = $1 AND organization_id = $2',
      [id, req.user.organizationId]
    );

    if (assetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const asset = assetResult.rows[0];
    const updatedAsset = {
      ...asset,
      usefulLifeYears: usefulLifeYears || asset.useful_life_years,
      salvageValue: salvageValue || asset.salvage_value
    };

    // Generate new schedule
    const scheduleData = await depreciationService.generateSchedule(
      updatedAsset, 
      method || 'STRAIGHT_LINE'
    );

    // Save to database
    const saveResult = await depreciationService.saveSchedule(id, scheduleData, userId);

    if (!saveResult.success) {
      return res.status(500).json({ error: saveResult.error });
    }

    res.json({
      success: true,
      message: 'Depreciation recalculated successfully',
       saveResult.scheduleData
    });
  } catch (error) {
    console.error('Error recalculating depreciation:', error);
    res.status(500).json({ error: 'Failed to recalculate depreciation' });
  }
});

module.exports = router;
```

---

### 2.5 Frontend Implementation Specifications

#### File: `frontend/components/assets/AssetDepreciationChart.jsx`

```jsx
import React, { useState, useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Asset Depreciation Chart Component
 * 
 * Features:
 * - Interactive line chart showing book value over time
 * - Accumulated depreciation overlay
 * - Method selection (Straight Line, Declining Balance, etc.)
 * - Real-time status cards
 * - Recalculation capability
 */
export default function AssetDepreciationChart({ assetId }) {
  const [depreciationMethod, setDepreciationMethod] = useState('STRAIGHT_LINE');
  const queryClient = useQueryClient();

  // Fetch chart data
  const {  chartResponse, isLoading: chartLoading, error: chartError } = useQuery({
    queryKey: ['depreciation-chart', assetId, depreciationMethod],
    queryFn: () => api.get(`/assets/${assetId}/depreciation-chart?method=${depreciationMethod}`)
  });

  // Fetch status summary
  const {  statusResponse, isLoading: statusLoading } = useQuery({
    queryKey: ['depreciation-status', assetId],
    queryFn: () => api.get(`/assets/${assetId}/depreciation-status`)
  });

  // Recalculate mutation
  const recalculateMutation = useMutation({
    mutationFn: (data) => api.post(`/assets/${assetId}/recalculate-depreciation`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['depreciation-chart', assetId]);
      queryClient.invalidateQueries(['depreciation-status', assetId]);
    }
  });

  const chartData = useMemo(() => {
    if (!chartResponse?.data?.data) return null;
    return chartResponse.data.data;
  }, [chartResponse]);

  const status = useMemo(() => {
    return statusResponse?.data?.data;
  }, [statusResponse]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      title: {
        display: true,
        text: 'Asset Depreciation Forecast',
        font: { size: 16, weight: 'bold' }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            return `${context.dataset.label}: $${value.toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}`;
          }
        }
      },
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        beginAtZero: false,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          callback: (value) => {
            if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
            return `$${value}`;
          }
        }
      }
    }
  };

  const handleRecalculate = () => {
    recalculateMutation.mutate({ method: depreciationMethod });
  };

  if (chartLoading || statusLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartError || !chartData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-gray-500">
            <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No depreciation data available</p>
            <p className="text-sm">This asset may not have depreciation configured</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-600" />
            Depreciation Timeline
          </CardTitle>
          
          <div className="flex items-center gap-3">
            <Select value={depreciationMethod} onValueChange={setDepreciationMethod}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STRAIGHT_LINE">Straight Line</SelectItem>
                <SelectItem value="DECLINING_BALANCE">Declining Balance</SelectItem>
                <SelectItem value="SUM_OF_YEARS_DIGITS">Sum of Years</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={recalculateMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
              Recalculate
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Chart */}
        <div className="h-80 mb-6">
          <Line data={chartData} options={chartOptions} />
        </div>

        {/* Status Cards */}
        {status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={DollarSign}
              label="Current Value"
              value={`$${status.currentBookValue?.toLocaleString()}`}
              trend={status.depreciationPercentage}%
              trendLabel="depreciated"
              color="blue"
            />
            
            <StatCard
              icon={TrendingDown}
              label="Total Depreciated"
              value={`$${status.totalDepreciated?.toLocaleString()}`}
              color="red"
            />
            
            <StatCard
              icon={Calendar}
              label="Remaining Life"
              value={`${status.remainingYears} years`}
              subValue={`${status.remainingMonths} months`}
              color="green"
            />
            
            <StatCard
              icon={DollarSign}
              label="Original Price"
              value={`$${status.purchasePrice?.toLocaleString()}`}
              color="gray"
            />
          </div>
        )}

        {/* Method Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Depreciation Method</p>
              <p className="text-xs text-gray-500">
                {depreciationMethod === 'STRAIGHT_LINE' && 'Equal depreciation amount each period'}
                {depreciationMethod === 'DECLINING_BALANCE' && 'Higher depreciation in early years'}
                {depreciationMethod === 'SUM_OF_YEARS_DIGITS' && 'Accelerated depreciation based on remaining life'}
              </p>
            </div>
            <Badge variant="outline">{depreciationMethod.replace(/_/g, ' ')}</Badge>
          </div>
        </div>

        {/* Fully Depreciated Warning */}
        {status?.isFullyDepreciated && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              ⚠️ This asset is fully depreciated (reached salvage value). 
              No further depreciation will be calculated.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Stat Card Sub-Component
 */
function StatCard({ icon: Icon, label, value, subValue, trend, trendLabel, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    green: 'bg-green-50 text-green-700',
    gray: 'bg-gray-50 text-gray-700'
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {subValue && <p className="text-xs opacity-75">{subValue}</p>}
      {trend && (
        <p className="text-xs mt-1">
          {trend} {trendLabel}
        </p>
      )}
    </div>
  );
}
```

---

## ✅ ACCEPTANCE CRITERIA

### Feature 1: Dynamic Mapping System

| # | Criterion | Priority |
|---|-----------|----------|
| 1 | System learns from user corrections and improves future suggestions | 🔴 Critical |
| 2 | Confidence scores displayed for each field mapping | 🔴 Critical |
| 3 | Organization-specific patterns stored and retrieved | 🔴 Critical |
| 4 | Required fields flagged when no suitable mapping found | 🔴 Critical |
| 5 | Mapping accuracy statistics visible to users | 🟡 High |
| 6 | "Narrow vision" mode for critical fields (higher thresholds) | 🟡 High |
| 7 | Feedback loop sends data to backend for pattern learning | 🔴 Critical |

### Feature 2: Depreciation Charts

| # | Criterion | Priority |
|---|-----------|----------|
| 1 | Depreciation schedule auto-generated on asset creation | 🔴 Critical |
| 2 | Interactive chart showing book value over time | 🔴 Critical |
| 3 | Multiple depreciation methods supported | 🟡 High |
| 4 | Status cards showing current value, total depreciated, remaining life | 🔴 Critical |
| 5 | Recalculation capability with method selection | 🟡 High |
| 6 | Fully depreciated assets clearly indicated | 🟡 High |
| 7 | Chart responsive and mobile-friendly | 🟢 Medium |

---

## 🧪 TESTING REQUIREMENTS

### Unit Tests
```javascript
// backend/tests/SmartMappingService.test.js
describe('SmartMappingService', () => {
  test('should calculate similarity with org pattern boost', async () => {});
  test('should record feedback and update patterns', async () => {});
  test('should generate mapping with narrow vision mode', async () => {});
});

// backend/tests/DepreciationService.test.js
describe('DepreciationService', () => {
  test('should calculate straight-line depreciation correctly', () => {});
  test('should calculate declining balance with multiplier', () => {});
  test('should not depreciate below salvage value', () => {});
  test('should generate chart-ready data format', async () => {});
});
```

### Integration Tests
```javascript
// Test full import flow with mapping feedback
// Test depreciation chart endpoint with various asset states
// Test organization pattern isolation (Org A shouldn't see Org B patterns)
```

### E2E Tests (Playwright/Cypress)
```javascript
// Upload Excel file → Review mappings → Provide feedback → Verify import
// Create asset → View depreciation chart → Change method → Verify recalculation
```

---

## 📁 FILE STRUCTURE AFTER IMPLEMENTATION

```
AMS-AI-System/
├── backend/
│   ├── services/
│   │   ├── SmartMappingService.js      ✨ ENHANCED
│   │   ├── DepreciationService.js      ✨ ENHANCED
│   │   └── DataImportService.js
│   ├── routes/
│   │   ├── import.js                   ✨ NEW ENDPOINTS
│   │   └── assets.js                   ✨ NEW ENDPOINTS
│   ├── middleware/
│   └── config/
│
├── frontend/
│   ├── components/
│   │   ├── import/
│   │   │   └── MappingWizard.jsx       ✨ NEW
│   │   └── assets/
│   │       └── AssetDepreciationChart.jsx  ✨ NEW
│   ├── pages/
│   └── lib/
│
└── database/
    └── migrations/
        ├── 001_add_mapping_feedback_tables.sql    ✨ NEW
        └── 002_add_depreciation_method_column.sql ✨ NEW
```

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] Run database migrations in correct order
- [ ] Update environment variables (if any new configs)
- [ ] Rebuild Docker containers
- [ ] Clear Redis cache for mapping patterns
- [ ] Test with sample Excel files (various formats)
- [ ] Verify chart rendering on different screen sizes
- [ ] Test feedback learning loop (upload → correct → re-upload)
- [ ] Load test with 1000+ asset imports
- [ ] Document new API endpoints in Swagger/OpenAPI

---

## 📝 NOTES FOR DEVELOPERS

1. **Mapping Learning**: The system improves over time. Initial accuracy may be ~60-70%, but should reach 85-95% after 10-20 imports per organization.

2. **Depreciation Performance**: For organizations with 10,000+ assets, consider batching depreciation calculations via cron jobs rather than real-time.

3. **Chart Optimization**: For assets with 10+ year useful life, consider sampling chart data points (e.g., show quarterly instead of monthly) to improve rendering performance.

4. **Data Privacy**: Organization patterns are isolated by org_id. Ensure this is enforced at database query level, not just application level.

5. **Feedback Incentive**: Consider gamifying feedback submission (e.g., "Mapping Accuracy Score" badge) to encourage user participation in the learning loop.

---

## 🎯 SUCCESS METRICS

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mapping Accuracy (after 20 imports) | ≥90% | Feedback correctness rate |
| Manual Mapping Time Reduction | ≥70% | Time comparison before/after |
| Depreciation Chart Load Time | <500ms | API response time |
| User Satisfaction (Mapping) | ≥4.5/5 | In-app survey |
| Import Error Rate | <2% | Failed imports / total imports |

---

**END OF PROMPT**

---

> 💡 **Usage Instructions**: Copy this entire prompt and provide it to Antigravity (or your AI development assistant). The prompt contains complete specifications, code templates, database schemas, API contracts, and acceptance criteria needed to implement both features to production quality.