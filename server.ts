import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory player database (persists during container runtime and can be synced)
interface ServerForestTree {
  id: string;
  species: string;
  commonName: string;
  growthPercent: number;
  seedsInvested: number;
  waterGiven: number;
  fertilizerGiven: number;
  stage: 'seed' | 'sprout' | 'sapling' | 'canopy' | 'mature';
  completedRealTree: boolean;
  certificateId?: string;
}

interface ServerPlantedTreeCertificate {
  id: string;
  species: string;
  commonName: string;
  region: string;
  coordinates: { lat: number; lng: number };
  plantedAt: number;
  co2PerYearKg: number;
  partner: string;
  dedicatedTo: string;
  certificateHash: string;
  realWorldImpact: string;
}

let currentPlayer = {
  id: 'explorer-1',
  name: 'Scholar Ash',
  email: 'scholar@academy.org',
  grade: '6-8',
  mainSubject: 'Math',
  level: 1,
  xp: 120,
  xpToNextLevel: 500,
  streakDays: 5,
  resources: {
    seeds: 6,
    water: 5,
    fertilizer: 3,
  },
  unlockedAreas: ['Algebra Grove'],
  currentArea: 'Algebra Grove',
  completedQuests: [] as string[],
  skillMastery: {
    'Quadratic Equations': 78,
    'Linear Equations': 85,
    'Graph Interpretation': 62,
    'Geometry Basics': 40,
  },
  learningStats: {
    visualSpeedScore: 80,
    textSpeedScore: 50,
    visualChallengesSolved: 14,
    textChallengesSolved: 6,
    accuracyRate: 88,
    totalAttempts: 22,
    hintsRequested: 4,
    strongTopics: ['Algebra', 'Pattern Matching'],
    developingTopics: ['Graph Interpretation', 'Multi-step Equations'],
    recommendedPath: 'visual' as const,
  },
  camp: {
    level: 2,
    buildings: {
      mapTable: { built: true, level: 1 },
      knowledgeBoard: { built: true, level: 1 },
      explorerTent: { built: true, level: 1 },
      plantBed: { built: true, level: 1, plantsCount: 2 },
    },
    plants: [
      {
        id: 'plant-1',
        stage: 'tree' as 'seed' | 'sprout' | 'tree',
        plantedAt: Date.now() - 3600000,
        waterCount: 3,
        fertilizerCount: 2,
      },
      {
        id: 'plant-2',
        stage: 'sprout' as 'seed' | 'sprout' | 'tree',
        plantedAt: Date.now() - 1200000,
        waterCount: 1,
        fertilizerCount: 0,
      }
    ],
  },
  // Save the Planet Hackathon Reforestation Features
  realTreesPlanted: 2,
  totalSaplingsGrown: 7,
  co2OffsetKg: 44,
  plantedTreeCertificates: [
    {
      id: 'ECO-TREE-8821',
      species: 'Rhizophora mucronata',
      commonName: 'Asiatic Red Mangrove',
      region: 'Mahajanga Estuary, Madagascar',
      coordinates: { lat: -15.7167, lng: 46.3167 },
      plantedAt: Date.now() - 86400000 * 3,
      co2PerYearKg: 22,
      partner: 'Eden Reforestation Projects',
      dedicatedTo: 'Scholar Ash',
      certificateHash: 'sha256-a9f8b7c6d5e4',
      realWorldImpact: 'Stabilizes coastal estuaries and sequesters 22kg CO2 annually.',
    },
    {
      id: 'ECO-TREE-8822',
      species: 'Acacia senegal',
      commonName: 'Gum Acacia',
      region: 'Great Green Wall, Senegal',
      coordinates: { lat: 14.4974, lng: -14.4524 },
      plantedAt: Date.now() - 86400000,
      co2PerYearKg: 22,
      partner: 'One Tree Planted Alliance',
      dedicatedTo: 'Scholar Ash',
      certificateHash: 'sha256-e3d2c1b0a9f8',
      realWorldImpact: 'Combats desertification along the Sahel corridor.',
    },
  ] as ServerPlantedTreeCertificate[],
  forestTrees: [
    {
      id: 'ft-1',
      species: 'Sequoiadendron giganteum',
      commonName: 'Giant Sequoia',
      growthPercent: 85,
      seedsInvested: 5,
      waterGiven: 4,
      fertilizerGiven: 2,
      stage: 'canopy',
      completedRealTree: false,
    },
    {
      id: 'ft-2',
      species: 'Adansonia digitata',
      commonName: 'African Baobab',
      growthPercent: 40,
      seedsInvested: 3,
      waterGiven: 2,
      fertilizerGiven: 1,
      stage: 'sapling',
      completedRealTree: false,
    },
    {
      id: 'ft-3',
      species: 'Acer saccharum',
      commonName: 'Sugar Maple',
      growthPercent: 15,
      seedsInvested: 2,
      waterGiven: 1,
      fertilizerGiven: 0,
      stage: 'sprout',
      completedRealTree: false,
    },
  ] as ServerForestTree[],
};

// Lazy Gemini AI initialization
let aiClient: GoogleGenAI | null = null;
function getGeminiAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (err) {
      console.error('Failed to initialize GoogleGenAI client:', err);
    }
  }
  return aiClient;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGemini: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString(),
  });
});

// Auth Routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email) {
    currentPlayer.email = email;
    if (email.includes('@')) {
      const parsedName = email.split('@')[0];
      currentPlayer.name = parsedName.charAt(0).toUpperCase() + parsedName.slice(1);
    }
  }
  res.json({ success: true, profile: currentPlayer });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, grade, mainSubject } = req.body;
  currentPlayer.name = name || 'Explorer';
  if (email) currentPlayer.email = email;
  if (grade) currentPlayer.grade = grade;
  if (mainSubject) currentPlayer.mainSubject = mainSubject;
  res.json({ success: true, profile: currentPlayer });
});

app.post('/api/auth/guest', (req, res) => {
  currentPlayer.name = 'Guest Explorer';
  currentPlayer.email = 'guest@adventure.academy';
  res.json({ success: true, profile: currentPlayer });
});

// Profile endpoints
app.get('/api/player/profile', (req, res) => {
  res.json(currentPlayer);
});

app.put('/api/player/profile', (req, res) => {
  const updates = req.body;
  currentPlayer = {
    ...currentPlayer,
    ...updates,
    resources: {
      ...currentPlayer.resources,
      ...(updates.resources || {}),
    },
    skillMastery: {
      ...currentPlayer.skillMastery,
      ...(updates.skillMastery || {}),
    },
    learningStats: {
      ...currentPlayer.learningStats,
      ...(updates.learningStats || {}),
    },
    camp: {
      ...currentPlayer.camp,
      ...(updates.camp || {}),
    },
  };
  res.json(currentPlayer);
});

// Quests API
const ALL_QUESTS = [
  {
    id: 'quest-01-bridge',
    number: 'QUEST 01',
    title: 'Repair the Bridge',
    learningConcept: 'Quadratic Equations',
    rewardSummary: '+100 XP | +3 Seeds | +1 Water | +1 Fertilizer',
    rewardXp: 100,
    rewardSeeds: 3,
    rewardWater: 1,
    rewardFertilizer: 1,
    difficulty: 'standard',
    unlocked: true,
    completed: false,
    type: 'equation',
  },
  {
    id: 'quest-02-parabola',
    number: 'QUEST 02',
    title: 'Visual Graph Calibration',
    learningConcept: 'Parabola Curve & Vertex',
    rewardSummary: '+120 XP | +2 Seeds | +2 Water',
    rewardXp: 120,
    rewardSeeds: 2,
    rewardWater: 2,
    rewardFertilizer: 1,
    difficulty: 'standard',
    unlocked: true,
    completed: false,
    type: 'graph',
  },
  {
    id: 'quest-03-river-stones',
    number: 'QUEST 03',
    title: 'Rushing River Stepping Stones',
    learningConcept: 'Multi-Step Algebraic Balance',
    rewardSummary: '+140 XP | +4 Seeds | +2 Fertilizer',
    rewardXp: 140,
    rewardSeeds: 4,
    rewardWater: 2,
    rewardFertilizer: 2,
    difficulty: 'standard',
    unlocked: true,
    completed: false,
    type: 'stepping_stones',
  },
  {
    id: 'quest-04-geometry-canopy',
    number: 'QUEST 04',
    title: 'The Sacred Polygon Shrine & Area Slicer',
    learningConcept: 'Alternate Interior Angles & Composite Area',
    rewardSummary: '+240 XP | +6 Seeds | +4 Water | +3 Fertilizer',
    rewardXp: 240,
    rewardSeeds: 6,
    rewardWater: 4,
    rewardFertilizer: 3,
    difficulty: 'challenge',
    unlocked: true,
    completed: false,
    type: 'geometry_canopy',
    areaId: 'Geometry Canopy',
  },
  {
    id: 'quest-05-geometry-gate',
    number: 'QUEST 05',
    title: 'Knowledge Gate: Geometry Canopy',
    learningConcept: 'Right-Angle Triangles & Pythagoras',
    rewardSummary: '+180 XP | +5 Seeds | +3 Water',
    rewardXp: 180,
    rewardSeeds: 5,
    rewardWater: 3,
    rewardFertilizer: 2,
    difficulty: 'challenge',
    unlocked: true,
    completed: false,
    type: 'knowledge_gate',
    areaId: 'Geometry Canopy',
  },
  {
    id: 'quest-06-probability-meadow',
    number: 'QUEST 06',
    title: 'The Dice of Destiny & Lucky Totems',
    learningConcept: 'Probability, Urn Sampling & Expected Value',
    rewardSummary: '+200 XP | +6 Seeds | +3 Water | +2 Fertilizer',
    rewardXp: 200,
    rewardSeeds: 6,
    rewardWater: 3,
    rewardFertilizer: 2,
    difficulty: 'challenge',
    unlocked: true,
    completed: false,
    type: 'probability',
    areaId: 'Probability Meadow',
  },
  {
    id: 'quest-07-trigonometry-trail',
    number: 'QUEST 07',
    title: 'The Beacon of Tangents & Watchtower',
    learningConcept: 'Trigonometric Ratios & Cliff Elevation',
    rewardSummary: '+220 XP | +5 Seeds | +4 Water | +2 Fertilizer',
    rewardXp: 220,
    rewardSeeds: 5,
    rewardWater: 4,
    rewardFertilizer: 2,
    difficulty: 'challenge',
    unlocked: true,
    completed: false,
    type: 'trigonometry',
    areaId: 'Trigonometry Trail',
  },
  {
    id: 'quest-08-master-circle',
    number: 'QUEST 08',
    title: 'Master Challenge: Quadratic Equations',
    learningConcept: 'Four Elemental Altars & Roots',
    rewardSummary: '+250 XP | +5 Seeds | +2 Water | +3 Fertilizer',
    rewardXp: 250,
    rewardSeeds: 5,
    rewardWater: 2,
    rewardFertilizer: 3,
    difficulty: 'master',
    unlocked: true,
    completed: false,
    type: 'master_circle',
    areaId: 'Exam Summit',
  },
];

app.get('/api/quests', (req, res) => {
  const questsWithState = ALL_QUESTS.map((q) => ({
    ...q,
    completed: currentPlayer.completedQuests.includes(q.id),
  }));
  res.json(questsWithState);
});

app.post('/api/quests/:id/complete', (req, res) => {
  const questId = req.params.id;
  const quest = ALL_QUESTS.find((q) => q.id === questId);
  if (!quest) {
    return res.status(404).json({ error: 'Quest not found' });
  }

  if (!currentPlayer.completedQuests.includes(questId)) {
    currentPlayer.completedQuests.push(questId);
    currentPlayer.xp += quest.rewardXp;
    currentPlayer.resources.seeds += quest.rewardSeeds;
    currentPlayer.resources.water += quest.rewardWater;
    currentPlayer.resources.fertilizer += quest.rewardFertilizer;

    // Check level up (every 300 XP)
    const newLevel = Math.floor(currentPlayer.xp / 300) + 1;
    if (newLevel > currentPlayer.level) {
      currentPlayer.level = newLevel;
    }

    // Boost mastery
    if (quest.learningConcept.includes('Quadratic')) {
      currentPlayer.skillMastery['Quadratic Equations'] = Math.min(
        100,
        (currentPlayer.skillMastery['Quadratic Equations'] || 70) + 14
      );
    } else if (quest.learningConcept.includes('Geometry')) {
      currentPlayer.skillMastery['Geometry Basics'] = Math.min(
        100,
        (currentPlayer.skillMastery['Geometry Basics'] || 40) + 25
      );
      if (!currentPlayer.unlockedAreas.includes('Geometry Canopy')) {
        currentPlayer.unlockedAreas.push('Geometry Canopy');
      }
    }
  }

  res.json({
    success: true,
    profile: currentPlayer,
    quest,
  });
});

// Farm & Camp Actions
app.post('/api/camp/plant', (req, res) => {
  if (currentPlayer.resources.seeds < 1) {
    return res.status(400).json({ error: 'Not enough seeds!' });
  }
  currentPlayer.resources.seeds -= 1;
  const newPlant = {
    id: `plant-${Date.now()}`,
    stage: 'seed' as const,
    plantedAt: Date.now(),
    waterCount: 0,
    fertilizerCount: 0,
  };
  currentPlayer.camp.plants.push(newPlant);
  res.json({ success: true, plant: newPlant, resources: currentPlayer.resources });
});

app.post('/api/camp/water', (req, res) => {
  const { plantId } = req.body;
  if (currentPlayer.resources.water < 1) {
    return res.status(400).json({ error: 'Not enough water!' });
  }
  const plant = currentPlayer.camp.plants.find((p) => p.id === plantId);
  if (!plant) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  currentPlayer.resources.water -= 1;
  plant.waterCount += 1;

  // Advance stage if enough water
  if (plant.stage === 'seed' && plant.waterCount >= 1) {
    plant.stage = 'sprout';
  } else if (plant.stage === 'sprout' && plant.waterCount >= 2) {
    plant.stage = 'tree';
  }

  res.json({ success: true, plant, resources: currentPlayer.resources });
});

app.post('/api/camp/fertilize', (req, res) => {
  const { plantId } = req.body;
  if (currentPlayer.resources.fertilizer < 1) {
    return res.status(400).json({ error: 'Not enough fertilizer!' });
  }
  const plant = currentPlayer.camp.plants.find((p) => p.id === plantId);
  if (!plant) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  currentPlayer.resources.fertilizer -= 1;
  plant.fertilizerCount += 1;
  // Supercharge to tree
  plant.stage = 'tree';

  res.json({ success: true, plant, resources: currentPlayer.resources });
});

app.post('/api/camp/harvest', (req, res) => {
  const { plantId } = req.body;
  const index = currentPlayer.camp.plants.findIndex((p) => p.id === plantId);
  if (index === -1) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  const plant = currentPlayer.camp.plants[index];
  if (plant.stage !== 'tree') {
    return res.status(400).json({ error: 'Plant is not ready for harvest!' });
  }

  // Grant rewards
  currentPlayer.xp += 50;
  currentPlayer.resources.seeds += 2;
  currentPlayer.resources.water += 1;
  currentPlayer.resources.fertilizer += 1;

  // Reset or remove plant
  currentPlayer.camp.plants.splice(index, 1);

  res.json({
    success: true,
    reward: { xp: 50, seeds: 2, water: 1, fertilizer: 1 },
    profile: currentPlayer,
  });
});

app.post('/api/camp/upgrade-building', (req, res) => {
  const { buildingKey } = req.body;
  const building = (currentPlayer.camp.buildings as any)[buildingKey];
  if (!building) {
    return res.status(404).json({ error: 'Building not found' });
  }

  building.built = true;
  building.level = (building.level || 0) + 1;
  currentPlayer.camp.level = Math.max(
    currentPlayer.camp.level,
    Math.min(
      ...Object.values(currentPlayer.camp.buildings).map((b: any) => b.level || 1)
    ) + 1
  );

  res.json({ success: true, camp: currentPlayer.camp });
});

// ==========================================
// SAVE THE PLANET: ECO REFORESTATION ROUTES
// ==========================================
let globalReforestationTally = 14892; // Community counter

const SPECIES_PRESETS = [
  { species: 'Rhizophora mucronata', commonName: 'Asiatic Red Mangrove', region: 'Mahajanga Estuary, Madagascar', lat: -15.7167, lng: 46.3167, impact: 'Coastal mangrove nursery shielding sea villages and storing massive blue carbon.' },
  { species: 'Acacia senegal', commonName: 'Gum Acacia', region: 'Great Green Wall, Senegal', lat: 14.4974, lng: -14.4524, impact: 'Thriving along the Sahel fringe, stopping desert dunes and restoring agricultural soils.' },
  { species: 'Sequoiadendron giganteum', commonName: 'Giant Sequoia', region: 'Sierra Nevada, California, USA', lat: 36.5647, lng: -118.7734, impact: 'Ancient giant sequestering hundreds of tonnes of atmospheric carbon over a millennium.' },
  { species: 'Adansonia digitata', commonName: 'African Baobab', region: 'Kilifi Coast, Kenya', lat: -3.6305, lng: 39.8499, impact: 'Tree of life storing thousands of liters of clean water and offering shelter to wildlife.' },
  { species: 'Swietenia macrophylla', commonName: 'Big-Leaf Mahogany', region: 'Madre de Dios, Peru (Amazon Basin)', lat: -12.5933, lng: -69.1891, impact: 'Rainforest canopy anchor restoring indigenous biodiversity and canopy humidity.' },
];

app.get('/api/eco/status', (req, res) => {
  res.json({
    realTreesPlanted: currentPlayer.realTreesPlanted,
    totalSaplingsGrown: currentPlayer.totalSaplingsGrown,
    co2OffsetKg: currentPlayer.co2OffsetKg,
    certificates: currentPlayer.plantedTreeCertificates,
    forestTrees: currentPlayer.forestTrees,
    globalTreesPlanted: globalReforestationTally,
  });
});

app.post('/api/eco/plant-tree', (req, res) => {
  const { speciesKey } = req.body;
  if (currentPlayer.resources.seeds < 2) {
    return res.status(400).json({ error: 'Need at least 2 seeds earned from math quests to plant a new forest sapling!' });
  }

  currentPlayer.resources.seeds -= 2;
  const preset = SPECIES_PRESETS[Math.floor(Math.random() * SPECIES_PRESETS.length)];
  const chosen = speciesKey ? SPECIES_PRESETS.find(p => p.commonName === speciesKey) || preset : preset;

  const newTree = {
    id: `ft-${Date.now()}`,
    species: chosen.species,
    commonName: chosen.commonName,
    growthPercent: 10,
    seedsInvested: 2,
    waterGiven: 0,
    fertilizerGiven: 0,
    stage: 'sprout' as const,
    completedRealTree: false,
  };

  currentPlayer.forestTrees.unshift(newTree);
  currentPlayer.totalSaplingsGrown += 1;

  res.json({
    success: true,
    tree: newTree,
    forestTrees: currentPlayer.forestTrees,
    resources: currentPlayer.resources,
  });
});

app.post('/api/eco/nurture', (req, res) => {
  const { treeId, itemType } = req.body; // 'water' or 'fertilizer'
  const tree = currentPlayer.forestTrees.find(t => t.id === treeId);
  if (!tree) {
    return res.status(404).json({ error: 'Tree not found in forest' });
  }

  if (itemType === 'water') {
    if (currentPlayer.resources.water < 1) {
      return res.status(400).json({ error: 'Not enough water! Solve math quests to draw river water.' });
    }
    currentPlayer.resources.water -= 1;
    tree.waterGiven += 1;
    tree.growthPercent = Math.min(100, tree.growthPercent + 20);
  } else if (itemType === 'fertilizer') {
    if (currentPlayer.resources.fertilizer < 1) {
      return res.status(400).json({ error: 'Not enough fertilizer! Solve challenges to compost knowledge.' });
    }
    currentPlayer.resources.fertilizer -= 1;
    tree.fertilizerGiven += 1;
    tree.growthPercent = Math.min(100, tree.growthPercent + 35);
  }

  // Update visual stage based on growth percentage
  if (tree.growthPercent >= 100) {
    tree.stage = 'mature';
  } else if (tree.growthPercent >= 60) {
    tree.stage = 'canopy';
  } else if (tree.growthPercent >= 30) {
    tree.stage = 'sapling';
  } else {
    tree.stage = 'sprout';
  }

  res.json({
    success: true,
    tree,
    resources: currentPlayer.resources,
  });
});

app.post('/api/eco/claim-real-tree', (req, res) => {
  const { treeId } = req.body;
  const tree = currentPlayer.forestTrees.find(t => t.id === treeId);
  if (!tree) {
    return res.status(404).json({ error: 'Tree not found in forest' });
  }
  if (tree.growthPercent < 100 && !tree.completedRealTree) {
    return res.status(400).json({ error: 'Tree must reach 100% full growth before planting a real tree on Earth!' });
  }

  if (!tree.completedRealTree) {
    tree.completedRealTree = true;
    currentPlayer.realTreesPlanted += 1;
    currentPlayer.co2OffsetKg += 22; // ~22 kg CO2 sequestered per mature tree per year
    globalReforestationTally += 1;

    // Match preset
    const preset = SPECIES_PRESETS.find(p => p.commonName === tree.commonName) || SPECIES_PRESETS[0];

    const certificate = {
      id: `ECO-EARTH-${Math.floor(10000 + Math.random() * 90000)}`,
      species: tree.species,
      commonName: tree.commonName,
      region: preset.region,
      coordinates: { lat: preset.lat, lng: preset.lng },
      plantedAt: Date.now(),
      co2PerYearKg: 22,
      partner: 'Eden Reforestation & One Tree Planted Alliance',
      dedicatedTo: currentPlayer.name || 'Scholar Explorer',
      certificateHash: `sha256-${Math.random().toString(36).substring(2, 12)}`,
      realWorldImpact: preset.impact,
    };

    tree.certificateId = certificate.id;
    currentPlayer.plantedTreeCertificates.unshift(certificate);
    currentPlayer.xp += 250; // Big bonus for saving the planet

    return res.json({
      success: true,
      certificate,
      realTreesPlanted: currentPlayer.realTreesPlanted,
      co2OffsetKg: currentPlayer.co2OffsetKg,
      globalTreesPlanted: globalReforestationTally,
      profile: currentPlayer,
    });
  }

  const existingCert = currentPlayer.plantedTreeCertificates.find(c => c.id === tree.certificateId);
  res.json({
    success: true,
    certificate: existingCert,
    realTreesPlanted: currentPlayer.realTreesPlanted,
    profile: currentPlayer,
  });
});
app.post('/api/ai/hint', async (req, res) => {
  const { question, currentInput, context } = req.body;
  const ai = getGeminiAI();

  if (ai) {
    try {
      const prompt = `You are "Nova", a wise, warm, and playful robotic winged fairy companion in the educational game "Adventure Academy: Learn. Adapt. Grow.".
The explorer student is working on this math challenge:
Question: "${question || 'x^2 - 5x + 6 = 0'}"
Current student thought / input: "${currentInput || 'not sure'}"
Grade Level: ${currentPlayer.grade}
Recent context: ${context || 'Solving quadratic equations at the broken bridge'}

Provide a short, gentle pedagogical hint (2 sentences maximum) in character.
Do NOT reveal the direct answer. Give a conceptual clue (like factoring, finding two numbers that multiply to 6 and add to -5, or visual stepping).
Tone: Encouraging, supportive, slightly whimsical fairy guide.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      const hintText = response.text?.trim();
      if (hintText) {
        currentPlayer.learningStats.hintsRequested += 1;
        return res.json({
          speaker: 'NOVA',
          hint: hintText,
          source: 'gemini-live',
        });
      }
    } catch (error) {
      console.warn('Gemini hint call error, falling back to local heuristic:', error);
    }
  }

  // Thoughtful local fallback
  currentPlayer.learningStats.hintsRequested += 1;
  let fallbackHint = "Look closely at the numbers: think of two numbers that multiply to give +6, and when added together make -5!";
  if (question && question.includes('3(x + 4) = 21')) {
    fallbackHint = "Try dividing both sides by 3 first, or distribute the 3 across (x + 4)!";
  } else if (question && question.includes('graph')) {
    fallbackHint = "Remember that changing 'a' widens or narrows the curve, while 'b' shifts the axis of symmetry!";
  }

  res.json({
    speaker: 'NOVA',
    hint: fallbackHint,
    source: 'rule-based',
  });
});

app.post('/api/ai/explain', async (req, res) => {
  const { question, topic } = req.body;
  const ai = getGeminiAI();

  if (ai) {
    try {
      const prompt = `You are "Nova" the AI companion in "Adventure Academy".
Explain the math problem "${question || 'x^2 - 5x + 6 = 0'}" (${topic || 'Quadratic Equations'}) using an intuitive visual or story analogy suited for Grade ${currentPlayer.grade}.
Keep it under 3 concise sentences. Make it feel like an adventure puzzle (e.g. stepping stones, archways, balancing weight).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      const explanation = response.text?.trim();
      if (explanation) {
        return res.json({
          speaker: 'NOVA',
          explanation,
          source: 'gemini-live',
        });
      }
    } catch (err) {
      console.warn('Gemini explain error:', err);
    }
  }

  res.json({
    speaker: 'NOVA',
    explanation:
      "Imagine building an archway over the river: factoring x² - 5x + 6 means finding the two ground anchor points where the arch hits height 0. Because (x - 2)(x - 3) = 0, either anchor x = 2 or x = 3 keeps the bridge steady!",
    source: 'rule-based',
  });
});

app.post('/api/ai/insight', async (req, res) => {
  const ai = getGeminiAI();
  const stats = currentPlayer.learningStats;

  if (ai) {
    try {
      const prompt = `You are "Nova", an AI companion analyzing player performance in Adventure Academy.
Student stats:
- Visual Speed Score: ${stats.visualSpeedScore}%
- Text Speed Score: ${stats.textSpeedScore}%
- Accuracy: ${stats.accuracyRate}%
- Strong Topics: ${stats.strongTopics.join(', ')}
- Developing Topics: ${stats.developingTopics.join(', ')}

Output a JSON object with:
1. "summary": One punchy sentence comparing visual vs text problem speed (e.g. "You solve visual problems faster than text-heavy problems.")
2. "recommendation": Brief actionable advice for their next quest path
3. "recommendedPath": "visual" or "text"`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        return res.json({
          speaker: 'NOVA',
          ...parsed,
          visualSpeedScore: stats.visualSpeedScore,
          textSpeedScore: stats.textSpeedScore,
        });
      }
    } catch (err) {
      console.warn('Gemini insight error:', err);
    }
  }

  res.json({
    speaker: 'NOVA',
    summary: 'You solve visual problems faster than text-heavy problems.',
    recommendation: 'Follow the Visual Graph Challenge to master parabolas through direct simulation!',
    recommendedPath: 'visual',
    visualSpeedScore: stats.visualSpeedScore,
    textSpeedScore: stats.textSpeedScore,
  });
});

app.post('/api/ai/adaptive-challenge', async (req, res) => {
  const { preference } = req.body;
  const ai = getGeminiAI();

  if (ai) {
    try {
      const prompt = `Generate a creative math challenge for an explorer in Adventure Academy (${preference || 'visual'} style, Grade ${currentPlayer.grade}).
Topic: Quadratic equations or algebraic balance.
Return JSON with:
{
  "equation": string,
  "question": string,
  "options": [{"text": string, "correct": boolean}],
  "novaTip": string
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        return res.json(parsed);
      }
    } catch (err) {
      console.warn('Adaptive challenge error:', err);
    }
  }

  res.json({
    equation: 'x² - 9 = 0',
    question: 'Solve for x to activate the ancient rune pedestals:',
    options: [
      { text: 'x = 3, -3', correct: true },
      { text: 'x = 9, -9', correct: false },
      { text: 'x = 0, 3', correct: false },
      { text: 'x = 4.5, -4.5', correct: false },
    ],
    novaTip: 'Notice this is a difference of two squares: (x - 3)(x + 3) = 0!',
  });
});

// Setup Vite development middleware or static production serve
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Adventure Academy server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
