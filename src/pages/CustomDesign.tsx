import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Upload, ShoppingBag, Loader, AlertCircle, ZoomIn, ZoomOut, Move, X, Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight, RotateCcw, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useToast } from '../components/ui/use-toast';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';
import { generateImage, generateImageWithHuggingFace } from '../lib/openaiService';
import html2canvas from 'html2canvas';
import { getOrCreateAnonymousId } from '../utils/userIdentifier';

// Type definitions
interface PhoneModel {
  id: string;
  name: string;
}

interface CaseType {
  id: string;
  name: string;
  price: number;
  image_url: string;
}

interface InventoryItem {
  id: string;
  phone_model_id: string;
  case_type_id: string;
  quantity: number;
  mockup_2d_path?: string;
  mockup_3d_path?: string;
}

// New interface for text elements
interface TextElement {
  id: string;
  text: string;
  position: { x: number, y: number };
  fontSize: number;
  fontFamily: string;
  color: string;
  isBold: boolean;
  isItalic: boolean;
  textAlign: 'left' | 'center' | 'right';
  isSelected: boolean;
}

// Define customizable case types
const CUSTOMIZABLE_CASE_TYPES = ['Tough Case', 'Silicone Case', 'Clear Case'];

// Font options
const FONT_FAMILIES = [
  'Arial', 
  'Helvetica', 
  'Verdana', 
  'Tahoma', 
  'Times New Roman', 
  'Georgia',
  'Courier New',
  'Impact'
];

// Font sizes
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];

// Color options
const COLOR_OPTIONS = [
  '#000000', // Black
  '#FFFFFF', // White
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFA500', // Orange
  '#800080', // Purple
  '#008080', // Teal
  '#FF69B4', // Hot Pink
];

export function CustomDesign() {
  // Get URL search params
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const caseTypeFromUrl = searchParams.get('caseType');
  const designId = searchParams.get('designId'); // Get designId from URL
  
  // State
  const [phoneModels, setPhoneModels] = useState<PhoneModel[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedPhoneModel, setSelectedPhoneModel] = useState<string | null>(null);
  const [selectedCaseType, setSelectedCaseType] = useState<string | null>(null);
  const [designImage, setDesignImage] = useState<string | null>(null);
  const [phoneMockupImage, setPhoneMockupImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false); // Track if we're editing an existing design
  
  // Text design state
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [activeTab, setActiveTab] = useState<'image' | 'text' | 'ai'>('image');
  const [newText, setNewText] = useState('');
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [textColor, setTextColor] = useState('#000000');
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [isEditingText, setIsEditingText] = useState(false);
  const [textDragging, setTextDragging] = useState(false);
  const [textDragStart, setTextDragStart] = useState({ x: 0, y: 0 });
  
  // Design customization state
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Refs for smoother animations
  const positionRef = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const imageDimensionsRef = useRef<{ width: number, height: number }>({ width: 0, height: 0 });
  const rafRef = useRef<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addToCart, isLoading: cartIsLoading, items } = useCart();

  // State for available case types after filtering
  const [availableCaseTypes, setAvailableCaseTypes] = useState<CaseType[]>([]);
  // State for 3D preview
  const [has3DPreview, setHas3DPreview] = useState(false);
  const [showing3DPreview, setShowing3DPreview] = useState(false);
  const [model3DPath, setModel3DPath] = useState<string | null>(null);
  const [is3DLoading, setIs3DLoading] = useState(false);
  
  // State for tracking which case types have 3D models
  
  // Refs for 3D preview
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const designTextureRef = useRef<THREE.Texture | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // AI image generation state
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [aiProvider, setAiProvider] = useState<'openai' | 'huggingface'>('openai');
  const [aiError, setAiError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        
        // Fetch all phone models
        const { data: allPhoneModelsData, error: phoneModelsError } = await supabase
          .from('phone_models')
          .select('*')
          .eq('active', true);
        
        if (phoneModelsError) throw phoneModelsError;
        
        // Fetch case types
        const { data: caseTypesData, error: caseTypesError } = await supabase
          .from('case_types')
          .select('*');
        
        if (caseTypesError) throw caseTypesError;
        
        // Filter case types to only include customizable ones
        const customizableCaseTypes = caseTypesData?.filter(
          caseType => CUSTOMIZABLE_CASE_TYPES.includes(caseType.name)
        ) || [];
        
        // Fetch inventory items to filter phone models
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory_items')
          .select('*');
          
        if (inventoryError) throw inventoryError;
        
        // Only show phone models that exist in inventory_items
        const availablePhoneModelIds = [...new Set(inventoryData?.map(item => item.phone_model_id) || [])];
        const filteredPhoneModels = allPhoneModelsData?.filter(model => 
          availablePhoneModelIds.includes(model.id)
        ) || [];
        
        console.log(`Found ${filteredPhoneModels.length} phone models in inventory out of ${allPhoneModelsData?.length || 0} total models`);
        
        setPhoneModels(filteredPhoneModels);
        setCaseTypes(customizableCaseTypes);
        
        // Only set default selections if we're not editing an existing design (no designId)
        if (!designId && filteredPhoneModels?.length) {
          setSelectedPhoneModel(filteredPhoneModels[0].id);
          
          // Handle URL case type parameter
          if (caseTypeFromUrl && customizableCaseTypes.length) {
            // Find matching case type
            const matchingCaseType = customizableCaseTypes.find(
              caseType => caseType.name === caseTypeFromUrl
            );
            
            if (matchingCaseType) {
              setSelectedCaseType(matchingCaseType.id);
            } else {
              // If specified case type is not customizable, select the first available
              setSelectedCaseType(customizableCaseTypes[0].id);
              // Notify user that their selection was not customizable
              toast({
                title: "Case type not customizable",
                description: `${caseTypeFromUrl} is not available for customization. Showing you customizable options instead.`,
                variant: "default"
              });
            }
          } else if (customizableCaseTypes.length) {
            // Default to first case type if none specified in URL
            setSelectedCaseType(customizableCaseTypes[0].id);
          }
        } else if (!filteredPhoneModels?.length) {
          setError("No phones available in inventory");
        }
        
        // Only fetch initial inventory if we're not loading a design and we have defaults set
        if (!designId && filteredPhoneModels?.length && customizableCaseTypes.length) {
          const caseTypeId = caseTypeFromUrl && customizableCaseTypes.find(ct => ct.name === caseTypeFromUrl)?.id;
          await fetchInventory(
            filteredPhoneModels[0].id, 
            caseTypeId || customizableCaseTypes[0].id
          );
        }
      } catch (err: any) {
        console.error("Error loading data:", err);
        setError("Failed to load data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [caseTypeFromUrl, designId]);
  
  // Fetch inventory data
  const fetchInventory = useCallback(async (phoneModelId: string, caseTypeId: string) => {
    try {
      const { data, error: inventoryError } = await supabase
        .from('inventory_items')
        .select(`
          id,
          phone_model_id,
          case_type_id,
          quantity,
          mockup_2d_path,
          mockup_3d_path,
          phone_models(name),
          case_types(name)
        `)
        .eq('phone_model_id', phoneModelId)
        .eq('case_type_id', caseTypeId);
      
      if (inventoryError) throw inventoryError;
      
      if (data && data.length > 0) {
        setInventory(data);
        
        // Get the first inventory item (should only be one for this combination)
        const item = data[0];
        
        // Set the 2D mockup image directly from the database
        if (item.mockup_2d_path) {
          // Get public URL from Supabase storage
          const { data: fileData } = supabase.storage
            .from('case-assets')
            .getPublicUrl(item.mockup_2d_path);
          
          setPhoneMockupImage(fileData.publicUrl);
          console.log(`Loading 2D mockup from: ${fileData.publicUrl}`);
        } else {
          setPhoneMockupImage(null);
        }
        
        // Set the 3D model path directly from the database
        if (item.mockup_3d_path) {
          // Get public URL from Supabase storage
          const { data: fileData } = supabase.storage
            .from('case-assets')
            .getPublicUrl(item.mockup_3d_path);
          
          setModel3DPath(fileData.publicUrl);
          setHas3DPreview(true);
          console.log(`Loading 3D model from: ${fileData.publicUrl}`);
        } else {
          setModel3DPath(null);
          setHas3DPreview(false);
        }
      } else {
        setInventory([]);
        setPhoneMockupImage(null);
        setModel3DPath(null);
        setHas3DPreview(false);
      }
    } catch (err) {
      console.error("Error fetching inventory:", err);
    }
  }, []);
  
  // Update inventory when phone model or case type changes
  useEffect(() => {
    if (selectedPhoneModel && selectedCaseType) {
      console.log(`Updating inventory for phone: ${selectedPhoneModel}, case: ${selectedCaseType}`);
      fetchInventory(selectedPhoneModel, selectedCaseType);
    }
  }, [selectedPhoneModel, selectedCaseType, fetchInventory]);
  
  // Sync position state with ref for animations
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  
  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);
  
  // Define phone model and case type mappings for mockup images
  const getPhoneMockupImage = (phoneModelName: string, caseTypeName: string, dimension = '2D') => {
    // First check if we have a custom mockup path in the inventory for this combination
    const inventoryItem = inventory.find(
      item => item.phone_model_id === selectedPhoneModel && item.case_type_id === selectedCaseType
    );
    
    // Use the custom mockup path if it exists
    if (inventoryItem) {
      const mockupPath = dimension === '2D' ? inventoryItem.mockup_2d_path : inventoryItem.mockup_3d_path;
      if (mockupPath) {
        // Get public URL from Supabase storage
        const { data } = supabase.storage.from('case-assets').getPublicUrl(mockupPath);
        console.log(`Using custom mockup path: ${mockupPath}`);
        return data.publicUrl;
      }
    }
    
    // Return null if no custom mockup is found
    console.log(`No mockup found for ${phoneModelName} - ${caseTypeName} (${dimension})`);
    return null;
  };

  // Helper function to check if a file exists in storage
  const checkFileExists = async (filePath: string) => {
    if (!filePath) return false;
    
    try {
      const { data, error } = await supabase.storage
        .from('case-assets')
        .list(filePath.split('/').slice(0, -1).join('/'), {
          search: filePath.split('/').pop()
        });
      
      return !error && data && data.length > 0;
    } catch (error) {
      console.error("Error checking if file exists:", error);
      return false;
    }
  };

  // Helper function to check which case types have actual mockups for a given phone model
  const filterAvailableCaseTypes = useCallback(async (phoneModelName: string) => {
    // Array to store available case types with confirmed mockup files
    const availableTypes: CaseType[] = [];
    
    // Only check inventory items for custom mockups
    try {
      // Get the phone model ID first
      const { data: phoneData, error: phoneError } = await supabase
        .from('phone_models')
        .select('id')
        .eq('name', phoneModelName)
        .single();
      
      if (phoneError || !phoneData) {
        console.error("Phone model not found:", phoneModelName);
        throw phoneError || new Error("Phone model not found");
      }
      
      // Now query inventory items for this phone model
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory_items')
        .select(`
          id,
          phone_model_id,
          case_type_id,
          mockup_2d_path,
          case_types(id, name, price, image_url)
        `)
        .eq('phone_model_id', phoneData.id);
      
      if (!inventoryError && inventoryData && inventoryData.length > 0) {
        // Find case types with custom mockups
        for (const item of inventoryData) {
          if (item.mockup_2d_path && item.case_types) {
            const caseType = item.case_types as unknown as CaseType;
            if (CUSTOMIZABLE_CASE_TYPES.includes(caseType.name)) {
              // Add to available types if not already included
              if (!availableTypes.some(ct => ct.id === caseType.id)) {
                availableTypes.push(caseType);
                console.log(`Found custom mockup for ${phoneModelName} - ${caseType.name}`);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Error checking inventory mockups:", err);
    }
    
    return availableTypes;
  }, []);

  // New function to check if 3D models exist for the given phone model and case types
  const filterAvailable3DModels = useCallback(async (phoneModelName: string, caseTypes: CaseType[]) => {
    // Object to store which case types have 3D models available
    const available3DModels: Record<string, boolean> = {};
    
    console.log(`Checking 3D models for phone: ${phoneModelName}`);
    
    // Check each case type for this phone model
    for (const caseType of caseTypes) {
      // Get the 3D model path from inventory
      const modelPath = getPhoneMockupImage(phoneModelName, caseType.name, '3D');
      
      // Mark as available only if a custom mockup was found
      const exists = modelPath !== null && await checkFileExists(modelPath);
      
      console.log(`3D model for ${phoneModelName} - ${caseType.name}: ${exists ? 'Found' : 'Not found'}`);
      
      // Store availability status
      available3DModels[caseType.id] = exists;
    }
    
    return available3DModels;
  }, []);

  // Function to update available case types when phone model changes
  const updateAvailableCaseTypes = useCallback(async (phoneModel: PhoneModel | undefined) => {
    if (!phoneModel || !caseTypes.length) return;
    
    // Show loading indicator
    setIsLoading(true);
    
    try {
      // Get case types that have mockup files
      const filteredCaseTypes = await filterAvailableCaseTypes(phoneModel.name);
      setAvailableCaseTypes(filteredCaseTypes);
      
      // If the currently selected case type is not available, select the first available one
      if (selectedCaseType) {
        const selectedCaseTypeObj = caseTypes.find(c => c.id === selectedCaseType);
        if (selectedCaseTypeObj && !filteredCaseTypes.some(c => c.id === selectedCaseType)) {
          setSelectedCaseType(filteredCaseTypes.length > 0 ? filteredCaseTypes[0].id : null);
        }
      } else if (filteredCaseTypes.length > 0) {
        // Auto-select the first available case type
        setSelectedCaseType(filteredCaseTypes[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  }, [caseTypes, selectedCaseType, filterAvailableCaseTypes]);
  
  // Effect to update available case types when phone model or case types change
  useEffect(() => {
    if (selectedPhoneModel) {
      const phoneModel = phoneModels.find(p => p.id === selectedPhoneModel);
      updateAvailableCaseTypes(phoneModel);
    }
  }, [selectedPhoneModel, phoneModels, caseTypes, updateAvailableCaseTypes]);

  // Check if 3D preview is available
  useEffect(() => {
    if (!selectedPhoneModel || !selectedCaseType) {
      setHas3DPreview(false);
      return;
    }
    
    // Get actual information about the selections
    const phoneModel = phoneModels.find(p => p.id === selectedPhoneModel);
    const caseType = caseTypes.find(c => c.id === selectedCaseType);
    
    console.log(`Selected phone: ${phoneModel?.name}, case: ${caseType?.name}`);
    
    // Check if 3D preview is available
    const check3DAvailability = async () => {
      // Find inventory item with the selected phone model and case type
      const inventoryItem = inventory.find(
        item => item.phone_model_id === selectedPhoneModel && item.case_type_id === selectedCaseType
      );
      
      // Check if the inventory item has a 3D mockup path
      if (inventoryItem && inventoryItem.mockup_3d_path) {
        try {
          // Get public URL from Supabase storage
          const { data: fileData } = supabase.storage
            .from('case-assets')
            .getPublicUrl(inventoryItem.mockup_3d_path);
          
          console.log('Checking 3D model availability at:', fileData.publicUrl);
          
          // Check if file exists using fetch HEAD request
          const response = await fetch(fileData.publicUrl, { method: 'HEAD' });
          
          if (response.ok) {
            // Set the model path
            setModel3DPath(fileData.publicUrl);
            setHas3DPreview(true);
            console.log(`3D preview available: ${fileData.publicUrl}`);
          } else {
            setHas3DPreview(false);
            setModel3DPath(null);
            console.log(`3D file not accessible: ${fileData.publicUrl}`);
          }
        } catch (error) {
          console.error('Error checking 3D model file:', error);
          setHas3DPreview(false);
          setModel3DPath(null);
        }
      } else {
        setHas3DPreview(false);
        setModel3DPath(null);
        console.log('No 3D model path found in inventory');
      }
    };
    
    check3DAvailability();
  }, [selectedCaseType, selectedPhoneModel, phoneModels, caseTypes, inventory]);

  // New effect to load available 3D models for all case types when phone model changes
  useEffect(() => {
    // Disable 3D model loading functionality
    // Original function has been commented out
    /*
    const loadAvailable3DModels = async () => {
      if (!selectedPhoneModel) return;

      // Get the phone model
      const phoneModel = phoneModels.find(p => p.id === selectedPhoneModel);
      if (!phoneModel?.name) return;
      
      // Get available 3D models for this phone model
      const models3D = await filterAvailable3DModels(phoneModel.name, caseTypes);
      setAvailable3DModels(models3D);
    };
    
    loadAvailable3DModels();
    */
  }, [selectedPhoneModel, phoneModels, caseTypes, filterAvailable3DModels]);

  // This effect was previously disabling 3D preview, but now we're using the check3DAvailability function above
  // to properly detect and enable 3D preview when available

  // New effect to set phone mockup image directly using the manual mapping
  useEffect(() => {
    if (!selectedPhoneModel || !selectedCaseType) return;
    
    // Get the phone model and case type names
    const phoneModel = phoneModels.find(p => p.id === selectedPhoneModel);
    const caseType = caseTypes.find(c => c.id === selectedCaseType);
    
    if (!phoneModel?.name || !caseType?.name) return;
    
    // Get mockup image path using the function that now only returns custom mockups
    const mockupPath = getPhoneMockupImage(phoneModel.name, caseType.name);
    
    // Set the phone mockup image (could be null if no custom mockup exists)
    setPhoneMockupImage(mockupPath);
    
    // Log for debugging
    if (mockupPath) {
      console.log(`Loading mockup from: ${mockupPath}`);
    } else {
      console.log(`No mockup available for ${phoneModel.name} - ${caseType.name}`);
      // You might want to set a default image or handle this case
    }
    
  }, [selectedPhoneModel, selectedCaseType, phoneModels, caseTypes]);

  // Function to handle 3D preview
  const handle3DPreview = () => {
    setShowing3DPreview(true);
    setIs3DLoading(true);
    // Initialize 3D scene when preview is shown
    setTimeout(() => {
      initThreeJS();
    }, 100); // Small delay to ensure the canvas is in the DOM
  };

  // Function to close 3D preview
  const close3DPreview = () => {
    setShowing3DPreview(false);
    
    // Clean up Three.js resources
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    
    if (designTextureRef.current) {
      designTextureRef.current.dispose();
      designTextureRef.current = null;
    }
    
    // Clear references
    sceneRef.current = null;
    cameraRef.current = null;
    controlsRef.current = null;
    modelRef.current = null;
  };
  
  // Initialize Three.js scene
  const initThreeJS = () => {
    if (!canvasRef.current || !model3DPath) return;
    
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(
      45, 
      canvasRef.current.clientWidth / canvasRef.current.clientHeight, 
      0.1, 
      1000
    );
    camera.position.set(0, 0, 7);
    cameraRef.current = camera;
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current,
      antialias: true
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Add OrbitControls for interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controlsRef.current = controls;
    
    // Initialize the DRACO loader
    const dracoLoader = new DRACOLoader();
    // Set the path to the Draco decoder
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    
    // Load 3D model
    const loader = new GLTFLoader();
    // Attach the Draco loader to the GLTF loader
    loader.setDRACOLoader(dracoLoader);
    
    console.log('Loading 3D model from:', model3DPath);
    
    loader.load(
      model3DPath,
      (gltf) => {
        console.log('3D model loaded successfully:', gltf);
        const model = gltf.scene;
        
        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center); // Center the model
        
        // Scale the model appropriately
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 4 / maxDim; // Adjust scale to fit in view
        model.scale.multiplyScalar(scale);
        
        // Add to scene
        scene.add(model);
        modelRef.current = model;
        
        // Apply custom design texture if available
        if (designImage) {
          applyDesignTexture(model, designImage);
        }
        
        // Add text elements to the model if available
        if (textElements.length > 0) {
          applyTextElements(model);
        }
        
        setIs3DLoading(false);
        
        // Auto-set optimal camera position once model is loaded
        setTimeout(() => {
          resetView();
        }, 100);
        
        // Start animation loop
        animate();
      },
      (progress) => {
        const percentComplete = progress.lengthComputable 
          ? Math.round((progress.loaded / progress.total) * 100) 
          : 0;
        console.log('Loading model progress:', percentComplete, '%');
      },
      (error) => {
        console.error('Error loading 3D model:', error);
        setIs3DLoading(false);
        toast({
          title: "3D Preview Error",
          description: "Failed to load the 3D model. Please try again. " + (error as Error).message,
          variant: "destructive"
        });
      }
    );
    
    // Handle window resize
    const handleResize = () => {
      if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Animation loop
    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !controlsRef.current) return;
      
      controlsRef.current.update();
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    // Clean up function
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  };
  
  // Apply design texture to the 3D model
  const applyDesignTexture = (model: THREE.Group, designImageUrl: string) => {
    if (!model) return;
    
    console.log('Applying design texture to 3D model');
    
    // Get case type name to check if it's a Clear Case
    const caseType = caseTypes.find(c => c.id === selectedCaseType);
    const isClearCase = caseType?.name === 'Clear Case';
    
    console.log(`Case type: ${caseType?.name}, Is Clear Case: ${isClearCase}`);
    
    // Create a texture loader
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      designImageUrl,
      (texture) => {
        // Store the texture reference for cleanup
        designTextureRef.current = texture;
        texture.colorSpace = THREE.SRGBColorSpace;
        
        // Apply user's position and zoom to the texture
        // Create a canvas to pre-process the texture with user's transformations
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Create an image to draw on canvas
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        img.onload = () => {
          // Set canvas dimensions to match phone mockup aspect ratio
          // Use a larger size for better quality
          const CANVAS_SIZE = isClearCase ? 2560 : 2048; // Higher resolution for clear cases
          canvas.width = CANVAS_SIZE;
          canvas.height = CANVAS_SIZE * (16/9); // Typical phone aspect ratio
          
          // Clear canvas with transparent background
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'transparent';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // For clear cases, add a very subtle white background to make design more visible
          if (isClearCase) {
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          // Calculate dimensions to match the 2D preview exactly
          const phoneContainer = containerRef.current;
          const phoneContainerWidth = phoneContainer?.clientWidth || 300;
          const phoneContainerHeight = phoneContainer?.clientHeight || 500;
          
          // Use the exact container aspect ratio instead of a fixed ratio
          const containerAspect = phoneContainerWidth / phoneContainerHeight;
          
          // Match canvas aspect ratio to container for perfect alignment
          if (canvas.width / canvas.height !== containerAspect) {
            canvas.height = canvas.width / containerAspect;
          }
          
          
          
          // IMPORTANT: Keep original image aspect ratio instead of fitting to container
          // Use the original image dimensions as the base and only apply zoom
          let drawWidth = img.width;
          let drawHeight = img.height;
          
          // Apply scale factor to match phone case dimensions in both 2D and 3D
          // Scale based on a fixed reference dimension to maintain consistency
          // Increase scale dramatically to make the image much larger in 3D view
          const baseScale = Math.min(
            (phoneContainerWidth * 2.0) / img.width,
            (phoneContainerHeight * 2.0) / img.height
          );
          
          // Apply base scale and user zoom
          drawWidth = img.width * baseScale * zoom;
          drawHeight = img.height * baseScale * zoom;
          
          // Center point of canvas
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          
          // Scale position values to match canvas dimensions exactly
          // This ensures the relative position matches between 2D and 3D
          const positionScaleX = canvas.width / phoneContainerWidth;
          const positionScaleY = canvas.height / phoneContainerHeight;
          
          // Draw the image with user's transformations
          ctx.save();
          
          // Translate to center first
          ctx.translate(centerX, centerY);
          // Apply user position (scaled)
          ctx.translate(position.x * positionScaleX, position.y * positionScaleY);
          
          // Make sure the image covers most of the back panel area
          // Similar to how it appears in the 2D preview
          const scaleFactor = 15.0; // Increase this value to make the image larger
          drawWidth *= scaleFactor;
          drawHeight *= scaleFactor;
          
          // Draw from center
          ctx.drawImage(img, -drawWidth/2, -drawHeight/2, drawWidth, drawHeight);
          
          // Add text elements to the canvas
          if (textElements.length > 0) {
            textElements.forEach(textEl => {
              // Set text properties
              ctx.font = `${textEl.isBold ? 'bold ' : ''}${textEl.isItalic ? 'italic ' : ''}${textEl.fontSize * positionScaleY}px ${textEl.fontFamily}`;
              ctx.fillStyle = textEl.color;
              ctx.textAlign = textEl.textAlign;
              ctx.textBaseline = 'middle';
              
              // Calculate text position relative to the center and scaled
              const textX = (textEl.position.x - phoneContainerWidth/2) * positionScaleX;
              const textY = (textEl.position.y - phoneContainerHeight/2) * positionScaleY;
              
              // Draw the text
              ctx.fillText(textEl.text, textX, textY);
            });
          }
          
          ctx.restore();
          
          // Create a new texture from the canvas
          const canvasTexture = new THREE.CanvasTexture(canvas);
          canvasTexture.colorSpace = THREE.SRGBColorSpace;
          canvasTexture.flipY = false;
          
          // Improve texture quality
          canvasTexture.minFilter = THREE.LinearFilter;
          canvasTexture.magFilter = THREE.LinearFilter;
          canvasTexture.anisotropy = 16; // Higher anisotropy for sharper textures at angles
          
          // Ensure the texture mapping is precise
          canvasTexture.mapping = THREE.UVMapping;
          canvasTexture.wrapS = THREE.ClampToEdgeWrapping;
          canvasTexture.wrapT = THREE.ClampToEdgeWrapping;
          
          // For Clear Cases, create a special material setup
          if (isClearCase) {
            console.log('Creating special material for clear case');
            
            // Create a clear case material with adjusted parameters
            const clearCaseMaterial = new THREE.MeshPhysicalMaterial({
              map: canvasTexture,
              transparent: true,
              opacity: 0.75,            // More visible
              roughness: 0.05,          // Very smooth
              metalness: 0.1,
              clearcoat: 1.0,           // High clearcoat for glass-like appearance
              clearcoatRoughness: 0.02, // Very smooth clearcoat
              envMapIntensity: 1.0,     // Higher reflection
              side: THREE.DoubleSide,
              depthWrite: true,
              premultipliedAlpha: true,
              color: new THREE.Color(0xffffff), // Slight white tint to make design more visible
              emissive: new THREE.Color(0x111111) // Slight emission to help design stand out
            });
            
            // Find back panel by geometry analysis instead of color
            // Clear case requires special handling since it doesn't have a specific color
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                // Check for specific mesh names first
                const isPotentialBackPanel = 
                  child.name.toLowerCase().includes('back') || 
                  child.name.toLowerCase().includes('panel') ||
                  child.name.toLowerCase().includes('case') ||
                  child.name.toLowerCase().includes('shell') ||
                  child.name.toLowerCase().includes('phone');
                
                if (isPotentialBackPanel && isLikelyBackPanel(child)) {
                  console.log('Found clear case back panel:', child.name);
                  
                  // Apply material to this mesh
                  if (Array.isArray(child.material)) {
                    // Make a copy of all materials
                    const materials = child.material.map((m: THREE.Material) => m.clone());
                    
                    // For clear cases, apply texture to all potentially visible materials
                    // to ensure the design is visible regardless of model structure
                    for (let i = 0; i < materials.length; i++) {
                      materials[i] = clearCaseMaterial.clone();
                      // Offset UVs slightly for each material to improve visibility
                      const newMat = materials[i] as THREE.MeshPhysicalMaterial;
                      if (newMat.map) {
                        newMat.map = canvasTexture.clone();
                        // Apply a UV transform matrix to position the texture correctly
                        // This can be adjusted based on the specific model UV mapping
                        const scaleX = 0.85; // Scale down slightly for better visibility on clear case
                        const scaleY = 0.85; // Scale down slightly for better visibility on clear case
                        // Adjust these offset values to fix positioning issues
                        // These specific offsets work better for clear cases
                        const offsetX = -0.2;  // Shift texture left slightly
                        const offsetY = -0.15; // Shift texture up slightly
                        
                        newMat.map.repeat.set(scaleX, scaleY);
                        newMat.map.offset.set(offsetX, offsetY);
                        newMat.needsUpdate = true;
                      }
                    }
                    
                    child.material = materials;
                  } else {
                    // Single material case
                    child.material = clearCaseMaterial;
                  }
                }
              }
            });
            
            return; // Skip the standard material application for clear cases
          }
          
          
          // Find all meshes in the model
          let targetMesh: THREE.Mesh | null = null;
          let targetMaterialIndex = -1;
          
          // Debug: Log the entire model hierarchy
          console.log('Model hierarchy:');
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              console.log(`Mesh: ${child.name}, Materials: ${Array.isArray(child.material) ? child.material.length : 'single'}`);
              if (Array.isArray(child.material)) {
                child.material.forEach((mat, idx) => {
                  if ((mat as THREE.MeshStandardMaterial).color) {
                    console.log(`  Material ${idx}: Color ${(mat as THREE.MeshStandardMaterial).color.getHexString()}`);
                  }
                });
              } else if (child.material && (child.material as THREE.MeshStandardMaterial).color) {
                console.log(`  Material: Color ${(child.material as THREE.MeshStandardMaterial).color.getHexString()}`);
              }
            }
          });
          
          // Find the back panel by looking for the largest flat surface with gray color
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              // Check for specific mesh names first
              const isBackPanel = 
                child.name.toLowerCase().includes('back') || 
                child.name.toLowerCase().includes('panel') ||
                child.name.toLowerCase().includes('case_back') ||
                child.name.toLowerCase().includes('phone_case') ||
                child.name.toLowerCase().includes('shell') ||
                child.name === 'Case' ||
                child.name === 'Back';
              
              if (isBackPanel) {
                console.log('Found potential back panel by name:', child.name);
                
                // If the mesh has multiple materials, find the gray one
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat, index) => {
                    if (mat.color) {
                      const colorHex = mat.color.getHexString().toLowerCase();
                      // Check for gray colors - look for ranges in light/medium gray
                      if (
                        colorHex.includes('cccccc') || 
                        colorHex.includes('dddddd') || 
                        colorHex.includes('eeeeee') ||
                        colorHex.includes('aaaaaa') ||
                        colorHex.includes('bbbbbb') ||
                        colorHex === 'c0c0c0' || 
                        colorHex === 'd3d3d3' ||
                        (colorHex[0] === colorHex[2] && colorHex[2] === colorHex[4] && parseInt(colorHex[0], 16) > 9)
                      ) {
                        console.log(`Found gray material in back panel at index ${index}, color: ${colorHex}`);
                        targetMesh = child;
                        targetMaterialIndex = index;
                      }
                    }
                  });
                } else if (child.material && child.material.color) {
                  const colorHex = child.material.color.getHexString().toLowerCase();
                  if (
                    colorHex.includes('cccccc') || 
                    colorHex.includes('dddddd') || 
                    colorHex.includes('eeeeee') ||
                    colorHex.includes('aaaaaa') ||
                    colorHex.includes('bbbbbb') ||
                    colorHex === 'c0c0c0' || 
                    colorHex === 'd3d3d3' ||
                    (colorHex[0] === colorHex[2] && colorHex[2] === colorHex[4] && parseInt(colorHex[0], 16) > 9)
                  ) {
                    console.log(`Found gray material in back panel, color: ${colorHex}`);
                    targetMesh = child;
                    targetMaterialIndex = -1; // Single material
                  }
                }
              }
              
              // If we haven't found a back panel by name, look for any mesh with gray material
              if (!targetMesh) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat, index) => {
                    if (mat.color) {
                      const colorHex = mat.color.getHexString().toLowerCase();
                      if (
                        colorHex.includes('cccccc') || 
                        colorHex.includes('dddddd') || 
                        colorHex.includes('eeeeee') ||
                        colorHex.includes('aaaaaa') ||
                        colorHex.includes('bbbbbb') ||
                        colorHex === 'c0c0c0' || 
                        colorHex === 'd3d3d3' ||
                        (colorHex[0] === colorHex[2] && colorHex[2] === colorHex[4] && parseInt(colorHex[0], 16) > 9)
                      ) {
                        // Check if this is a large flat surface (likely the back panel)
                        if (isLikelyBackPanel(child)) {
                          console.log(`Found gray material in mesh ${child.name} at index ${index}, color: ${colorHex}`);
                          targetMesh = child;
                          targetMaterialIndex = index;
                        }
                      }
                    }
                  });
                } else if (child.material && child.material.color) {
                  const colorHex = child.material.color.getHexString().toLowerCase();
                  if (
                    colorHex.includes('cccccc') || 
                    colorHex.includes('dddddd') || 
                    colorHex.includes('eeeeee') ||
                    colorHex.includes('aaaaaa') ||
                    colorHex.includes('bbbbbb') ||
                    colorHex === 'c0c0c0' || 
                    colorHex === 'd3d3d3' ||
                    (colorHex[0] === colorHex[2] && colorHex[2] === colorHex[4] && parseInt(colorHex[0], 16) > 9)
                  ) {
                    // Check if this is a large flat surface (likely the back panel)
                    if (isLikelyBackPanel(child)) {
                      console.log(`Found gray material in mesh ${child.name}, color: ${colorHex}`);
                      targetMesh = child;
                      targetMaterialIndex = -1; // Single material
                    }
                  }
                }
              }
            }
          });
          
          // If we found a target mesh, apply the texture to it
          if (targetMesh) {
            console.log('Applying texture to:', (targetMesh as THREE.Mesh).name, 'material index:', targetMaterialIndex);
            
            // Create a new material with the canvas texture
            const newMaterial = new THREE.MeshStandardMaterial({
              map: canvasTexture,
              transparent: false,
              opacity: 1.0,
              roughness: 0.5,
              metalness: 0.1
            });
            
            // Apply the material
            if (targetMaterialIndex >= 0 && Array.isArray((targetMesh as THREE.Mesh).material)) {
              // Clone all materials to avoid modifying shared materials
              const materials = ((targetMesh as THREE.Mesh).material as THREE.Material[]).map((m: THREE.Material) => m.clone());
              // Replace only the target material
              materials[targetMaterialIndex] = newMaterial;
              (targetMesh as THREE.Mesh).material = materials;
            } else {
              // Single material case
              (targetMesh as THREE.Mesh).material = newMaterial;
            }
            
            console.log('Successfully applied texture to back panel');
          } else {
            console.warn('Could not find a suitable back panel mesh to apply the texture');
            
            // Fallback: Try to find the largest flat surface
            const flatSurfaces = findLargestFlatSurfaces(model);
            if (flatSurfaces.length > 0) {
              console.log('Applying texture to largest flat surface as fallback');
              const { mesh, materialIndex } = flatSurfaces[0];
              
              // Create an enhanced material that will make the design more visible
              const enhancedMaterial = new THREE.MeshStandardMaterial({
                map: canvasTexture,
                transparent: false,
                opacity: 1.0,
                roughness: 0.2,
                metalness: 0.0,
                envMapIntensity: 0.5,
                side: THREE.FrontSide
              });
              
              if (materialIndex >= 0 && Array.isArray(mesh.material)) {
                const materials = (mesh.material as THREE.Material[]).map((m: THREE.Material) => m.clone());
                materials[materialIndex] = enhancedMaterial;
                mesh.material = materials;
              } else {
                mesh.material = enhancedMaterial;
              }
              
              // Apply texture to all large flat surfaces to ensure visibility
              if (flatSurfaces.length > 1) {
                for (let i = 1; i < Math.min(flatSurfaces.length, 3); i++) {
                  const { mesh: additionalMesh, materialIndex: additionalMatIndex } = flatSurfaces[i];
                  
                  if (additionalMatIndex >= 0 && Array.isArray(additionalMesh.material)) {
                    const additionalMaterials = (additionalMesh.material as THREE.Material[]).map((m: THREE.Material) => m.clone());
                    additionalMaterials[additionalMatIndex] = enhancedMaterial.clone();
                    additionalMesh.material = additionalMaterials;
                  } else {
                    additionalMesh.material = enhancedMaterial.clone();
                  }
                }
              }
            }
          }
        };
        
        img.src = designImageUrl;
      },
      (progress) => {
        console.log('Texture loading progress:', progress);
      },
      (error) => {
        console.error('Error loading texture:', error);
        toast({
          title: "Design Error",
          description: "Failed to apply your design to the 3D model. Please try again.",
          variant: "destructive"
        });
      }
    );
  };
  
  // Apply text elements to the 3D model - Now part of the main texture
  const applyTextElements = (_model: THREE.Group) => {
    // We now handle text in the applyDesignTexture function
    // by drawing text onto the canvas texture
    console.log("Text elements are handled in main texture");
  };
  
  // Helper function to determine if a mesh is likely to be the back panel
  const isLikelyBackPanel = (mesh: THREE.Mesh): boolean => {
    // Skip known non-back parts
    if (
      mesh.name.toLowerCase().includes('edge') ||
      mesh.name.toLowerCase().includes('side') ||
      mesh.name.toLowerCase().includes('border') ||
      mesh.name.toLowerCase().includes('camera') ||
      mesh.name.toLowerCase().includes('button')
    ) {
      return false;
    }
    
    // Check if this has a large flat area (characteristic of back panels)
    const geometry = mesh.geometry;
    let zFacingNormals = 0;
    let totalNormals = 0;
    
    if (geometry.attributes.normal) {
      const normals = geometry.attributes.normal.array;
      for (let i = 0; i < normals.length; i += 3) {
        totalNormals++;
        const z = Math.abs(normals[i + 2]);
        if (z > 0.8) { // Mostly facing forward/backward
          zFacingNormals++;
        }
      }
      
      // Calculate the ratio of z-facing normals
      const ratio = totalNormals > 0 ? zFacingNormals / totalNormals : 0;
      
      // Also check for size - back panels tend to be larger
      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3());
      const area = size.x * size.y;
      
      console.log(`Mesh ${mesh.name} - z-facing ratio: ${ratio.toFixed(2)}, area: ${area.toFixed(2)}`);
      
      // Return true if it has a significant portion of z-facing normals and is relatively large
      return ratio > 0.4 && area > 1.0;
    }
    
    return false;
  };
  
  // Helper function to find the largest flat surfaces in the model
  const findLargestFlatSurfaces = (model: THREE.Group): Array<{mesh: THREE.Mesh, materialIndex: number, area: number}> => {
    const surfaces: Array<{mesh: THREE.Mesh, materialIndex: number, area: number}> = [];
    
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Skip known non-back parts
        if (
          child.name.toLowerCase().includes('edge') ||
          child.name.toLowerCase().includes('side') ||
          child.name.toLowerCase().includes('border') ||
          child.name.toLowerCase().includes('camera') ||
          child.name.toLowerCase().includes('button')
        ) {
          return;
        }
        
        const geometry = child.geometry;
        if (geometry.attributes.normal) {
          let zFacingNormals = 0;
          let totalNormals = 0;
          
          const normals = geometry.attributes.normal.array;
          for (let i = 0; i < normals.length; i += 3) {
            totalNormals++;
            const z = Math.abs(normals[i + 2]);
            if (z > 0.7) { // More permissive check for z-facing normals
              zFacingNormals++;
            }
          }
          
          const ratio = totalNormals > 0 ? zFacingNormals / totalNormals : 0;
          
          // More permissive condition to find flat surfaces
          if (ratio > 0.2) { // Reduced from 0.3 to catch more potential surfaces
            const box = new THREE.Box3().setFromObject(child);
            const size = box.getSize(new THREE.Vector3());
            const area = size.x * size.y;
            
            console.log(`Found potential surface: ${child.name}, z-ratio: ${ratio.toFixed(2)}, area: ${area.toFixed(2)}`);
            
            // Always consider surfaces with significant area
            if (area > 0.5) { // Reduced threshold to catch more surfaces
              if (Array.isArray(child.material)) {
                // Try to find gray materials in multi-material mesh
                let foundGrayMaterial = false;
                child.material.forEach((mat: THREE.Material, index: number) => {
                  if ((mat as THREE.MeshStandardMaterial).color) {
                    const colorHex = (mat as THREE.MeshStandardMaterial).color.getHexString().toLowerCase();
                    // Expand the color range to catch more gray-ish colors
                    if (
                      colorHex.includes('a') || 
                      colorHex.includes('b') || 
                      colorHex.includes('c') || 
                      colorHex.includes('d') || 
                      colorHex.includes('e') || 
                      colorHex.includes('f') ||
                      colorHex === '808080' ||
                      colorHex === '909090'
                    ) {
                      surfaces.push({ mesh: child, materialIndex: index, area });
                      foundGrayMaterial = true;
                    }
                  }
                });
                
                // If no gray material found, add the first material anyway
                if (!foundGrayMaterial && child.material.length > 0) {
                  surfaces.push({ mesh: child, materialIndex: 0, area });
                }
              } else {
                // Single material case - always add
                surfaces.push({ mesh: child, materialIndex: -1, area });
              }
            }
          }
        }
      }
    });
    
    // Sort surfaces by area (largest first)
    return surfaces.sort((a, b) => b.area - a.area);
  };
  
  // Reset 3D view to default
  const resetView = () => {
    if (!controlsRef.current || !cameraRef.current) return;
    
    // Position camera to show the back of the phone case clearly
    cameraRef.current.position.set(0, 0, 5);
    
    // Adjust the camera target to point directly at the case back
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    
    // Set camera to look straight at the case back
    if (modelRef.current) {
      // Position camera for optimal viewing angle
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // Calculate optimal distance based on model size
      const maxDim = Math.max(size.x, size.y);
      const fov = cameraRef.current.fov * (Math.PI / 180);
      const cameraDistance = maxDim / (2 * Math.tan(fov / 2));
      
      // Position camera slightly angled for better viewing
      cameraRef.current.position.set(
        center.x, 
        center.y, 
        center.z + cameraDistance * 1.2
      );
      
      // Point camera at the center of the model
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  };

  // Store image dimensions when image is loaded
  const handleImageLoad = useCallback((img: HTMLImageElement) => {
    imageDimensionsRef.current = {
      width: img.naturalWidth,
      height: img.naturalHeight
    };
  }, []);

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const fileSizeInMB = file.size / (1024 * 1024);
    const maxSizeInMB = 10; // Set the max size to 10MB
    
    // Strict size validation
    if (fileSizeInMB > maxSizeInMB) {
      // Show error message
      toast({
        title: "File too large",
        description: `Image size (${fileSizeInMB.toFixed(1)}MB) exceeds the ${maxSizeInMB}MB limit. Please select a smaller image.`,
        variant: "destructive"
      });
      
      // Reset input value to allow reselecting
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Don't continue with processing
      return;
    }
    
    // Continue only with valid file sizes
    const reader = new FileReader();
    
    reader.onload = (e) => {
      if (!e.target?.result) {
        toast({
          title: "Upload failed",
          description: "Failed to read the image data. Please try again.",
          variant: "destructive"
        });
        return;
      }
      
      const result = e.target.result as string;
      
      // Resize image if needed
      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 2000;
        const width = img.width;
        const height = img.height;
        const maxDimension = Math.max(width, height);
        
        // Only resize if the max dimension exceeds 2000px
        if (maxDimension > MAX_DIMENSION) {
          const canvas = document.createElement('canvas');
          let newWidth, newHeight;
          
          // Calculate new dimensions maintaining aspect ratio
          if (width >= height) {
            // Landscape or square image
            newWidth = MAX_DIMENSION;
            newHeight = Math.round(height * (MAX_DIMENSION / width));
          } else {
            // Portrait image
            newHeight = MAX_DIMENSION;
            newWidth = Math.round(width * (MAX_DIMENSION / height));
          }
          
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, newWidth, newHeight);
          
          // Convert to base64
          const resizedImage = canvas.toDataURL('image/png');
          setDesignImage(resizedImage);
          
          console.log(`Image resized from ${width}x${height} to ${newWidth}x${newHeight}`);
        } else {
          // Use original image if it doesn't need resizing
          setDesignImage(result);
        }
        
        // Reset position and zoom when a new image is uploaded
        setPosition({ x: 0, y: 0 });
        positionRef.current = { x: 0, y: 0 };
        setZoom(1);
        
        // Reset input value to allow reselecting same file
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Show success message
        toast({
          title: "Image uploaded",
          description: "Your image has been uploaded successfully.",
        });
      };
      
      img.onerror = () => {
        toast({
          title: "Upload failed",
          description: "Failed to process the image. Please try a different file.",
          variant: "destructive"
        });
        
        // Reset input value to allow reselecting
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      
      img.src = result;
    };
    
    reader.onerror = () => {
      toast({
        title: "Upload failed",
        description: "Failed to load the image. Please try again with a different file.",
        variant: "destructive"
      });
      
      // Reset input value to allow reselecting
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    
    reader.readAsDataURL(file);
  };
  
  // Update the image transformation with requestAnimationFrame for smoother animation
  const updateImageTransform = useCallback((x: number, y: number) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      positionRef.current = { x, y };
      setPosition({ x, y });
    });
  }, []);
  
  // Image positioning functions - optimized for smooth animation
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start new drag if we're already dragging text
    if (textDragging) return;
    
    // Deselect any selected text when clicking on the background
    if (selectedTextId) {
      const updatedElements = textElements.map(el => ({
        ...el,
        isSelected: false
      }));
      setTextElements(updatedElements);
      setSelectedTextId(null);
    }
    
    if (!designImage) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y
    });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !designImage) return;
    
    e.preventDefault();
    const x = e.clientX - dragStart.x;
    const y = e.clientY - dragStart.y;
    
    updateImageTransform(x, y);
  }, [isDragging, dragStart, designImage, updateImageTransform]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add optimized touch support for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!designImage) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - positionRef.current.x,
      y: touch.clientY - positionRef.current.y
    });
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !designImage) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const x = touch.clientX - dragStart.x;
    const y = touch.clientY - dragStart.y;
    
    updateImageTransform(x, y);
  }, [isDragging, dragStart, designImage, updateImageTransform]);

  const handleTouchEnd = () => {
    setIsDragging(false);
  };
  
  // Image manipulation functions
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };
  
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev * 0.8, 0.1));
  };
  
  const handleRemoveImage = () => {
    setDesignImage(null);
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
    setZoom(1);
  };
  
  // Calculate if the item is in stock
  const isInStock = () => {
    if (!selectedPhoneModel || !selectedCaseType) return false;
    
    const inventoryItem = inventory.find(
      item => item.phone_model_id === selectedPhoneModel && item.case_type_id === selectedCaseType
    );
    
    return inventoryItem ? inventoryItem.quantity > 0 : false;
  };
  
  // Get selected phone name
  const getSelectedPhoneName = () => {
    if (!selectedPhoneModel) return "No phone model selected";
    
    const phone = phoneModels.find(p => p.id === selectedPhoneModel);
    return phone ? phone.name : "Unknown model";
  };
  
  // Get selected case price
  const getSelectedCasePrice = () => {
    if (!selectedCaseType) return '0.00';
    
    const caseType = caseTypes.find(c => c.id === selectedCaseType);
    return caseType ? caseType.price.toFixed(2) : '0.00';
  };
  
  // Handle text element addition
  const handleAddText = () => {
    if (!newText.trim()) return;
    
    const containerWidth = containerRef.current?.clientWidth || 300;
    const containerHeight = containerRef.current?.clientHeight || 500;
    
    const newTextElement: TextElement = {
      id: uuidv4(),
      text: newText,
      position: { x: containerWidth / 2 - 50, y: containerHeight / 2 - 10 },
      fontSize,
      fontFamily,
      color: textColor,
      isBold,
      isItalic,
      textAlign,
      isSelected: true
    };
    
    // Deselect all existing text elements
    const updatedElements = textElements.map(el => ({
      ...el,
      isSelected: false
    }));
    
    setTextElements([...updatedElements, newTextElement]);
    setSelectedTextId(newTextElement.id);
    setNewText('');
    setIsEditingText(false);
  };
  
  // Handle text element selection
  const handleSelectText = (id: string) => {
    const selectedElement = textElements.find(el => el.id === id);
    if (!selectedElement) return;
    
    // Update styles to match selected element
    setFontSize(selectedElement.fontSize);
    setFontFamily(selectedElement.fontFamily);
    setTextColor(selectedElement.color);
    setIsBold(selectedElement.isBold);
    setIsItalic(selectedElement.isItalic);
    setTextAlign(selectedElement.textAlign);
    
    // Update selection state
    const updatedElements = textElements.map(el => ({
      ...el,
      isSelected: el.id === id
    }));
    
    setTextElements(updatedElements);
    setSelectedTextId(id);
  };
  
  // Handle text element editing
  const handleEditText = (id: string, newValue: string) => {
    const updatedElements = textElements.map(el => 
      el.id === id ? { ...el, text: newValue } : el
    );
    setTextElements(updatedElements);
  };
  
  // Handle text element deletion
  const handleDeleteText = (id: string) => {
    setTextElements(textElements.filter(el => el.id !== id));
    if (selectedTextId === id) {
      setSelectedTextId(null);
    }
  };
  
  // Handle text style updates
  const handleUpdateTextStyle = (
    property: 'fontSize' | 'fontFamily' | 'color' | 'isBold' | 'isItalic' | 'textAlign',
    value: any
  ) => {
    if (!selectedTextId) return;
    
    const updatedElements = textElements.map(el => 
      el.id === selectedTextId ? { ...el, [property]: value } : el
    );
    
    setTextElements(updatedElements);
    
    // Update local state for the selected style
    switch (property) {
      case 'fontSize':
        setFontSize(value);
        break;
      case 'fontFamily':
        setFontFamily(value);
        break;
      case 'color':
        setTextColor(value);
        break;
      case 'isBold':
        setIsBold(value);
        break;
      case 'isItalic':
        setIsItalic(value);
        break;
      case 'textAlign':
        setTextAlign(value);
        break;
    }
  };
  
  // Handle text element dragging
  const handleTextMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    // Select the text element if not already selected
    if (selectedTextId !== id) {
      handleSelectText(id);
    }
    
    const element = textElements.find(el => el.id === id);
    if (!element) return;
    
    setTextDragging(true);
    setTextDragStart({
      x: e.clientX - element.position.x,
      y: e.clientY - element.position.y
    });
  };
  
  const handleTextMouseMove = useCallback((e: React.MouseEvent) => {
    if (!textDragging || !selectedTextId) return;
    e.preventDefault();
    e.stopPropagation();
    
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    
    // Calculate position relative to container
    const newX = e.clientX - textDragStart.x;
    const newY = e.clientY - textDragStart.y;
    
    // Update text element position
    const updatedElements = textElements.map(el => 
      el.id === selectedTextId 
        ? { ...el, position: { x: newX, y: newY } } 
        : el
    );
    
    setTextElements(updatedElements);
  }, [textDragging, selectedTextId, textDragStart, textElements]);
  
  const handleTextMouseUp = () => {
    setTextDragging(false);
  };
  
  // Handle add to cart with text elements
  const handleAddToCart = async () => {
    if (!selectedPhoneModel || !selectedCaseType) {
      toast({
        title: "Please select options",
        description: "You need to select a phone model and case type",
        variant: "destructive"
      });
      return;
    }
    
    if (!designImage && textElements.length === 0) {
      toast({
        title: "No design added",
        description: "Please upload an image or add text for your custom case",
        variant: "destructive"
      });
      return;
    }
    
    if (!isInStock()) {
      toast({
        title: "Out of stock",
        description: "This case is currently out of stock",
        variant: "destructive"
      });
      return;
    }
    
    // Show loading state during image capture
    toast({
      title: "Processing",
      description: "Preparing your custom case...",
    });
    
    try {
      const selectedCase = caseTypes.find(c => c.id === selectedCaseType);
      const selectedPhone = phoneModels.find(p => p.id === selectedPhoneModel);
      const inventoryItem = inventory.find(
        i => i.phone_model_id === selectedPhoneModel && i.case_type_id === selectedCaseType
      );
      
      if (!selectedCase || !selectedPhone || !inventoryItem) {
        toast({
          title: "Error",
          description: "Failed to find product information",
          variant: "destructive"
        });
        return;
      }
      
      // Capture the design preview
      let capturedImage: string | undefined = undefined;
      
      try {
        capturedImage = await captureDesignPreview();
        console.log("Successfully captured design preview");
      } catch (err) {
        console.error("Failed to capture design preview:", err);
      }
      
      // Check if we're editing an existing design
      const existingId = searchParams.get('designId');
      const existingItem = existingId ? items.find(item => item.designId === existingId) : null;
      
      // Generate a design ID to be used as reference for retrieving designs
      const newDesignId = existingId || `design_${Date.now()}_${selectedPhoneModel}_${selectedCaseType}`;
      
      // Upload designs to Supabase storage
      let customDesignPath = null;
      let mockupImagePath = null;
      
      // Upload original design if exists
      if (designImage) {
        customDesignPath = await uploadDesignToStorage(designImage, 'custom', newDesignId);
      } else if (existingItem?.customDesign) {
        // If we're updating and there's no new design but old one exists, keep the old path
        customDesignPath = existingItem.customDesign;
      }
      
      // Upload mockup image if captured successfully
      if (capturedImage) {
        mockupImagePath = await uploadDesignToStorage(capturedImage, 'mockup', newDesignId);
      } else if (existingItem?.mockup2D) {
        // If we're updating and there's no new mockup but old one exists, keep the old path
        mockupImagePath = existingItem.mockup2D;
      }
      
      // Create cart item
      const cartItem = {
        id: existingItem?.id || uuidv4(),
        name: `Custom ${selectedCase.name}`,
        price: selectedCase.price,
        image: selectedCase.image_url, // Use case image as thumbnail
        customDesign: customDesignPath || (existingItem?.customDesign) || undefined, // Keep old path if no new upload
        mockup2D: mockupImagePath || (existingItem?.mockup2D) || (phoneMockupImage || undefined), // Keep old mockup if no new capture
        phoneName: selectedPhone.name,
        caseTypeName: selectedCase.name,
        customDesignPosition: position,
        customDesignZoom: zoom,
        customTextElements: textElements,
        type: selectedPhone.name,
        inventoryItemId: inventoryItem.id,
        phoneModelId: selectedPhoneModel,
        caseTypeId: selectedCaseType,
        quantity: existingItem?.quantity || 1, // Preserve quantity if editing, otherwise set to 1
        designId: newDesignId  // Add design ID for reference
      };
      
      // Add to cart
      await addToCart(cartItem);
      
      toast({
        title: existingItem ? "Design updated" : "Added to cart",
        description: existingItem 
          ? "Your custom case design has been updated" 
          : "Your custom case has been added to your cart"
      });
      
      navigate('/cart');
    } catch (error) {
      console.error("Error adding to cart:", error);
      toast({
        title: "Error",
        description: "Failed to add item to cart. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Set up mouse event listeners for text dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (textDragging && selectedTextId) {
        e.preventDefault();
        
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;
        
        // Calculate position relative to container
        const newX = e.clientX - textDragStart.x;
        const newY = e.clientY - textDragStart.y;
        
        // Update text element position
        const updatedElements = textElements.map(el => 
          el.id === selectedTextId 
            ? { ...el, position: { x: newX, y: newY } } 
            : el
        );
        
        setTextElements(updatedElements);
      }
    };
    
    const handleGlobalMouseUp = () => {
      if (textDragging) {
        setTextDragging(false);
      }
    };
    
    // Add global event listeners for text dragging to ensure it works even when cursor moves outside the container
    if (textDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [textDragging, selectedTextId, textDragStart, textElements]);
  
  // Set up touch event listeners for text dragging on mobile
  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (textDragging && selectedTextId) {
        const touch = e.touches[0];
        
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;
        
        // Calculate position relative to container
        const newX = touch.clientX - textDragStart.x;
        const newY = touch.clientY - textDragStart.y;
        
        // Update text element position
        const updatedElements = textElements.map(el => 
          el.id === selectedTextId 
            ? { ...el, position: { x: newX, y: newY } } 
            : el
        );
        
        setTextElements(updatedElements);
      }
    };
    
    const handleGlobalTouchEnd = () => {
      if (textDragging) {
        setTextDragging(false);
      }
    };
    
    // Add global event listeners for text dragging to ensure it works even when touch moves outside the container
    if (textDragging) {
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }
    
    return () => {
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [textDragging, selectedTextId, textDragStart, textElements]);

  // Handle AI image generation
  const handleGenerateImage = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsGeneratingImage(true);
    setAiError(null);
    
    try {
      let imageUrl;
      
      if (aiProvider === 'openai') {
        // Use OpenAI DALL-E
        imageUrl = await generateImage(aiPrompt);
        
        // Convert URL to base64 for consistency with Hugging Face
        if (imageUrl) {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const reader = new FileReader();
          
          // Convert blob to base64
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          
          imageUrl = await base64Promise;
        }
      } else {
        // Use Hugging Face
        imageUrl = await generateImageWithHuggingFace(aiPrompt);
      }
      
      // Resize image if needed (same logic as in handleImageUpload)
      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 2000;
        const width = img.width;
        const height = img.height;
        const maxDimension = Math.max(width, height);
        
        // Only resize if the max dimension exceeds 2000px
        if (maxDimension > MAX_DIMENSION) {
          const canvas = document.createElement('canvas');
          let newWidth, newHeight;
          
          // Calculate new dimensions maintaining aspect ratio
          if (width >= height) {
            // Landscape or square image
            newWidth = MAX_DIMENSION;
            newHeight = Math.round(height * (MAX_DIMENSION / width));
          } else {
            // Portrait image
            newHeight = MAX_DIMENSION;
            newWidth = Math.round(width * (MAX_DIMENSION / height));
          }
          
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, newWidth, newHeight);
          
          // Convert to base64
          const resizedImage = canvas.toDataURL('image/png');
          setDesignImage(resizedImage);
          
          console.log(`AI-generated image resized from ${width}x${height} to ${newWidth}x${newHeight}`);
        } else {
          // Use original image if it doesn't need resizing
          setDesignImage(imageUrl);
        }
        
        // Reset position and zoom
        setPosition({ x: 0, y: 0 });
        positionRef.current = { x: 0, y: 0 };
        setZoom(1);
        
        // Reset the form and switch to image tab to show result
        setActiveTab('image');
        toast({
          title: "Image generated",
          description: "Your AI-generated image is ready to use."
        });
      };
      
      img.onerror = () => {
        console.error('Error loading AI-generated image for resizing');
        setDesignImage(imageUrl); // Fall back to the original image
        
        // Reset the form and switch to image tab to show result
        setActiveTab('image');
        toast({
          title: "Image generated",
          description: "Your AI-generated image is ready to use."
        });
      };
      
      img.src = imageUrl;
    } catch (err: any) {
      console.error('Error generating image:', err);
      setAiError(err.message || 'Failed to generate image. Please try again.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Chụp ảnh mockup với thiết kế hiện tại
  const captureDesignPreview = async (): Promise<string> => {
    if (!containerRef.current) {
      throw new Error("Preview container not found");
    }
    
    try {
      // Tạm thời thêm .capture-ready để đảm bảo các phần tử được vẽ đúng
      containerRef.current.classList.add('capture-ready');
      
      // Store original background color
      const originalBgColor = containerRef.current.style.backgroundColor || '';
      
      // Set a specific background color that will be transparent in the final image
      containerRef.current.style.backgroundColor = "transparent";
      
      // Sử dụng html2canvas để chụp ảnh phần tử hiện tại
      const canvas = await html2canvas(containerRef.current, {
        scale: 2, // Tăng độ phân giải
        useCORS: true, // Cho phép tải ảnh từ các domain khác
        allowTaint: true, // Cho phép vẽ nội dung từ các domain khác
        backgroundColor: null, // Nền trong suốt
        logging: false, // Giảm output trong console
      });
      
      // Restore original background
      containerRef.current.style.backgroundColor = originalBgColor;
      
      // Loại bỏ class tạm thời
      containerRef.current.classList.remove('capture-ready');
      
      // Trim whitespace by finding the bounds of the non-transparent pixels
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let left = canvas.width;
        let right = 0;
        let top = canvas.height;
        let bottom = 0;
        
        // Find edges of content
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const alpha = data[(y * canvas.width + x) * 4 + 3];
            if (alpha > 0) {
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
          }
        }
        
        // Add a small margin (5px)
        const margin = 10;
        left = Math.max(0, left - margin);
        top = Math.max(0, top - margin);
        right = Math.min(canvas.width, right + margin);
        bottom = Math.min(canvas.height, bottom + margin);
        
        // Create a new canvas with the trimmed size
        if (left < right && top < bottom) {
          const trimmedWidth = right - left;
          const trimmedHeight = bottom - top;
          
          const trimmedCanvas = document.createElement('canvas');
          trimmedCanvas.width = trimmedWidth;
          trimmedCanvas.height = trimmedHeight;
          
          const trimmedCtx = trimmedCanvas.getContext('2d');
          trimmedCtx?.drawImage(
            canvas, 
            left, top, trimmedWidth, trimmedHeight,
            0, 0, trimmedWidth, trimmedHeight
          );
          
          // Return the trimmed image
          return trimmedCanvas.toDataURL('image/png');
        }
      }
      
      // Fallback to the full canvas if trimming failed
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error("Error capturing design preview:", error);
      throw error;
    } finally {
      // Đảm bảo loại bỏ class dù có lỗi xảy ra
      if (containerRef.current?.classList.contains('capture-ready')) {
        containerRef.current.classList.remove('capture-ready');
      }
    }
  };

  // Function to upload design to Supabase storage
  const uploadDesignToStorage = async (designImage: string, designType: 'mockup' | 'custom', designId?: string): Promise<string | null> => {
    try {
      if (!designImage) return null;
      
      // Check if we're editing an existing design
      const existingId = searchParams.get('designId');
      let oldFilePath: string | null = null;
      
      // If editing, find existing file paths to delete later
      if (existingId) {
        const existingItem = items.find(item => item.designId === existingId);
        if (existingItem) {
          if (designType === 'custom' && existingItem.customDesign) {
            oldFilePath = existingItem.customDesign;
          } else if (designType === 'mockup' && existingItem.mockup2D) {
            oldFilePath = existingItem.mockup2D;
          }
        }
      }
      
      // Convert base64 to blob
      const base64Response = await fetch(designImage);
      const blob = await base64Response.blob();
      
      // Lấy ID người dùng từ cookie thay vì tạo mới ngẫu nhiên
      const userId = getOrCreateAnonymousId();
      const timestamp = Date.now();
      
      // Tạo một ID ngẫu nhiên ngắn cho định dạng tên file mới
      const randomId = Math.random().toString(36).substring(2, 10);
      
      // Tên file theo định dạng mới: type_randomId_timestamp.png
      const fileName = `${designType}_${randomId}_${timestamp}.png`;
      
      // Path in the storage - tổ chức theo thư mục người dùng
      const filePath = `temp/${userId}/${fileName}`;
      
      // Upload to Supabase storage
      const { error } = await supabase.storage
        .from('case-assets')
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: true
        });
        
      if (error) {
        console.error("Error uploading design to storage:", error);
        return null;
      }
      
      // Get the public URL
      supabase.storage
        .from('case-assets')
        .getPublicUrl(filePath);
        
      console.log(`Design uploaded successfully to: ${filePath}`);
      
      // Delete old file if it exists and is in the temp folder
      if (oldFilePath && oldFilePath.startsWith('temp/')) {
        try {
          const { error: deleteError } = await supabase.storage
            .from('case-assets')
            .remove([oldFilePath]);
            
          if (deleteError) {
            console.error(`Error deleting old ${designType} file:`, deleteError);
          } else {
            console.log(`Successfully deleted old ${designType} file: ${oldFilePath}`);
          }
        } catch (deleteErr) {
          console.error(`Failed to delete old ${designType} file:`, deleteErr);
        }
      }
      
      return filePath; // Return the path for reference in the cart
    } catch (error) {
      console.error("Error in uploadDesignToStorage:", error);
      return null;
    }
  };

  // Load design from cart if designId is provided
  useEffect(() => {
    const loadDesignFromCart = async () => {
      if (!designId) return;
      
      console.log("Loading design from cart with designId:", designId);
      
      try {
        // Find the item in cart with the given designId
        const item = items.find(item => item.designId === designId);
        
        if (!item) {
          console.warn(`Design with ID ${designId} not found in cart`);
          return;
        }
        
        console.log("Found cart item to edit:", item);
        setIsEditing(true);
        
        // Set phone model and case type
        let phoneModelId = null;
        let caseTypeId = null;
        
        if (item.phoneModelId) {
          console.log(`Setting phone model from cart to: ${item.phoneModelId}`);
          setSelectedPhoneModel(item.phoneModelId);
          phoneModelId = item.phoneModelId;
        }
        
        if (item.caseTypeId) {
          console.log(`Setting case type from cart to: ${item.caseTypeId}`);
          setSelectedCaseType(item.caseTypeId);
          caseTypeId = item.caseTypeId;
        }
        
        // Fetch inventory data if both IDs are available
        if (phoneModelId && caseTypeId) {
          console.log(`Fetching inventory for phone: ${phoneModelId}, case: ${caseTypeId}`);
          await fetchInventory(phoneModelId, caseTypeId);
        }
        
        // Load design image from storage if path is provided
        if (item.customDesign && item.customDesign.startsWith('temp/')) {
          const { data } = supabase.storage
            .from('case-assets')
            .getPublicUrl(item.customDesign);
          
          if (data.publicUrl) {
            console.log(`Loading design image from: ${data.publicUrl}`);
            // Create an image to load the URL and convert to base64
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = data.publicUrl;
            
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0);
              
              const base64Image = canvas.toDataURL('image/png');
              setDesignImage(base64Image);
            };
          }
        }
        
        // Set position and zoom if available
        if (item.customDesignPosition) {
          setPosition(item.customDesignPosition);
          positionRef.current = item.customDesignPosition;
        }
        
        if (item.customDesignZoom) {
          setZoom(item.customDesignZoom);
        }
        
        // Set text elements if available
        if (item.customTextElements && item.customTextElements.length > 0) {
          setTextElements(item.customTextElements);
        }
        
        toast({
          title: "Design loaded",
          description: "Your design has been loaded for editing"
        });
      } catch (error) {
        console.error("Error loading design from cart:", error);
        toast({
          title: "Error",
          description: "Failed to load your design. Please try again.",
          variant: "destructive"
        });
      }
    };
    
    if (phoneModels.length > 0) {
      loadDesignFromCart();
    }
  }, [designId, items, phoneModels, fetchInventory]);

  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-2">
            {isEditing ? "Edit Your Design" : "Custom Case Designer"}
          </h1>
          <p className="text-gray-600 text-center mb-12">
            {isEditing 
              ? "Modify your custom phone case design" 
              : "Create your unique phone case in minutes"
            }
          </p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}
          
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-12">
              {/* Preview Section */}
              <div className="bg-white p-8 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold">Preview</h2>
                  <div className="flex gap-2 items-center">
                    {designImage && (
                      <button
                        onClick={handleRemoveImage}
                        className="p-2 rounded-lg hover:bg-gray-100 transition text-red-500"
                        title="Remove Image"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                    {(designImage || textElements.length > 0) && (
                      <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        {designImage && (
                          <>
                            <button
                              onClick={handleZoomOut}
                              className="p-2 rounded-lg hover:bg-gray-200 transition"
                              title="Zoom Out"
                            >
                              <ZoomOut className="w-5 h-5" />
                            </button>
                            <span className="px-2 text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
                            <button
                              onClick={handleZoomIn}
                              className="p-2 rounded-lg hover:bg-gray-200 transition"
                              title="Zoom In"
                            >
                              <ZoomIn className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        {designImage && (
                          <div className="p-2" title="Drag to Move">
                            <Move className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className="text-center mb-2 text-sm text-gray-500">
                    {getSelectedPhoneName()}
                  </div>
                  
                  <div 
                    ref={containerRef}
                    className="aspect-[9/16] w-full max-w-[300px] bg-gray-100 rounded-3xl overflow-hidden relative"
                    onMouseDown={handleMouseDown}
                    onMouseMove={(e) => {
                      if (textDragging) {
                        handleTextMouseMove(e);
                      } else {
                        handleMouseMove(e);
                      }
                    }}
                    onMouseUp={() => {
                      handleMouseUp();
                      handleTextMouseUp();
                    }}
                    onMouseLeave={() => {
                      handleMouseUp();
                      handleTextMouseUp();
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    {/* Show design display area with optional overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {designImage ? (
                        <div 
                          className="absolute inset-0 flex items-center justify-center overflow-hidden z-10"
                          style={{
                            cursor: isDragging ? 'grabbing' : 'grab'
                          }}
                        >
                          <img 
                            ref={imageRef}
                            src={designImage} 
                            alt="Your Design" 
                            onLoad={(e) => handleImageLoad(e.target as HTMLImageElement)}
                            style={{
                              transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${zoom})`,
                              transformOrigin: 'center',
                              maxWidth: 'none',
                              maxHeight: 'none',
                              objectFit: 'contain',
                              userSelect: 'none',
                              willChange: 'transform', // Optimize performance for transforms
                              backfaceVisibility: 'hidden', // Enhance GPU acceleration
                              perspective: 1000, // Enhance GPU acceleration
                              transition: isDragging ? 'none' : 'transform 0.05s linear'
                            }}
                            draggable={false}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full z-10">
                          {textElements.length === 0 && (
                            <Upload className="w-16 h-16 text-gray-400 opacity-70" />
                          )}
                        </div>
                      )}
                      
                      {/* Text elements layer */}
                      {textElements.map((textEl) => (
                        <div
                          key={textEl.id}
                          className={`absolute z-30 cursor-move ${textEl.isSelected ? 'ring-2 ring-blue-500' : ''}`}
                          style={{
                            top: 0,
                            left: 0,
                            transform: `translate(${textEl.position.x}px, ${textEl.position.y}px)`,
                            color: textEl.color,
                            fontSize: `${textEl.fontSize}px`,
                            fontFamily: textEl.fontFamily,
                            fontWeight: textEl.isBold ? 'bold' : 'normal',
                            fontStyle: textEl.isItalic ? 'italic' : 'normal',
                            textAlign: textEl.textAlign,
                            userSelect: 'none',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseDown={(e) => handleTextMouseDown(e, textEl.id)}
                          onDoubleClick={() => {
                            // Start text editing
                            setIsEditingText(true);
                            setNewText(textEl.text);
                          }}
                        >
                          {textEl.text}
                        </div>
                      ))}
                    </div>
                    
                    {/* Phone mockup image overlay */}
                    {phoneMockupImage && (
                      <img 
                        src={phoneMockupImage} 
                        alt="Phone Mockup" 
                        className="absolute inset-0 w-full h-full object-contain z-40 pointer-events-none"
                      />
                    )}
                  </div>
                  
                  {(designImage || textElements.length > 0) && (
                    <p className="text-sm text-gray-500 mt-4 text-center">
                      {designImage ? "Drag to adjust position • Use zoom controls to resize" : ""}
                      {textElements.length > 0 ? (designImage ? " • " : "") + "Click text to edit • Double-click to change text" : ""}
                    </p>
                  )}
                  
                  {/* 3D Preview Button */}
                  {has3DPreview && (
                    <button
                      onClick={handle3DPreview}
                      className="mt-6 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium flex items-center justify-center mx-auto shadow-sm"
                    >
                      <span className="mr-2">Preview in 3D</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-cube"><path d="m21 16-9 5-9-5"/><path d="m21 8-9 5-9-5"/><path d="m3 8 9-5 9 5"/></svg>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Configuration Section */}
              <div>
                <div className="bg-white p-8 rounded-2xl shadow-sm mb-6">
                  <h3 className="text-xl font-semibold mb-4">Select Your Device</h3>
                  {phoneModels.length > 0 ? (
                    <select
                      className="w-full p-3 border rounded-lg mb-6"
                      value={selectedPhoneModel || ''}
                      onChange={(e) => setSelectedPhoneModel(e.target.value)}
                    >
                      <option value="">Choose your phone model</option>
                      {phoneModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg mb-6">
                      No devices available in inventory. Please check back later.
                    </div>
                  )}

                  <h3 className="text-xl font-semibold mb-4">Choose Case Type</h3>
                  {availableCaseTypes.length > 0 ? (
                    <div className="space-y-3">
                      {availableCaseTypes.map((caseType) => (
                        <label 
                          key={caseType.id}
                          className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="caseType"
                              value={caseType.id}
                              checked={selectedCaseType === caseType.id}
                              onChange={() => setSelectedCaseType(caseType.id)}
                              className="w-4 h-4"
                            />
                            <span>{caseType.name}</span>
                          </div>
                          <span className="font-semibold">${caseType.price.toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                      No case types available for this device. Please select a different device.
                    </div>
                  )}
                  
                  {!isInStock() && selectedPhoneModel && selectedCaseType && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                      This case is currently out of stock
                    </div>
                  )}
                </div>

                {/* Design Tools Section with Tabs */}
                <div className="bg-white p-8 rounded-2xl shadow-sm mb-6">
                  <div className="flex border-b mb-6">
                    <button
                      className={`pb-2 px-4 ${activeTab === 'image' 
                        ? 'border-b-2 border-black font-medium' 
                        : 'text-gray-500'}`}
                      onClick={() => setActiveTab('image')}
                    >
                      Upload Image
                    </button>
                    <button
                      className={`pb-2 px-4 ${activeTab === 'text' 
                        ? 'border-b-2 border-black font-medium' 
                        : 'text-gray-500'}`}
                      onClick={() => setActiveTab('text')}
                    >
                      Add Text
                    </button>
                    <button
                      className={`pb-2 px-4 ${activeTab === 'ai' 
                        ? 'border-b-2 border-black font-medium' 
                        : 'text-gray-500'}`}
                      onClick={() => setActiveTab('ai')}
                    >
                      AI Image
                    </button>
                  </div>
                  
                  {activeTab === 'image' && (
                    <>
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        Upload Your Design
                      </h3>
                      <label className="block w-full p-4 border-2 border-dashed rounded-lg text-center cursor-pointer hover:bg-gray-50">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/jpg"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                        <p className="text-xs text-red-500 mt-1">Files larger than 10MB will be rejected</p>
                      </label>
                    </>
                  )}
                  
                  {activeTab === 'text' && (
                    <>
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Type className="w-5 h-5" />
                        Add Text
                      </h3>
                      
                      <div className="mb-4">
                        <div className="flex">
                          <input
                            ref={textInputRef}
                            type="text"
                            value={newText}
                            onChange={(e) => setNewText(e.target.value)}
                            placeholder="Enter your text here"
                            className="flex-1 p-3 border rounded-l-lg"
                          />
                          <button
                            onClick={handleAddText}
                            disabled={!newText.trim()}
                            className={`px-4 py-2 rounded-r-lg ${
                              !newText.trim() 
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                                : 'bg-black text-white hover:bg-gray-800'
                            }`}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      
                      {/* Text Styling Controls */}
                      <div className={`space-y-4 ${!selectedTextId ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="border-t pt-4">
                          <h4 className="font-medium mb-2">Text Style</h4>
                          
                          {/* Font Family */}
                          <div className="mb-3">
                            <label className="text-sm text-gray-600 block mb-1">Font</label>
                            <select
                              value={fontFamily}
                              onChange={(e) => handleUpdateTextStyle('fontFamily', e.target.value)}
                              className="w-full p-2 border rounded"
                            >
                              {FONT_FAMILIES.map(font => (
                                <option key={font} value={font} style={{ fontFamily: font }}>
                                  {font}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Font Size */}
                          <div className="mb-3">
                            <label className="text-sm text-gray-600 block mb-1">Size</label>
                            <select
                              value={fontSize}
                              onChange={(e) => handleUpdateTextStyle('fontSize', parseInt(e.target.value))}
                              className="w-full p-2 border rounded"
                            >
                              {FONT_SIZES.map(size => (
                                <option key={size} value={size}>
                                  {size}px
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Text Color */}
                          <div className="mb-3">
                            <label className="text-sm text-gray-600 block mb-1">Color</label>
                            <div className="flex flex-wrap gap-2">
                              {COLOR_OPTIONS.map(color => (
                                <button
                                  key={color}
                                  onClick={() => handleUpdateTextStyle('color', color)}
                                  className={`w-8 h-8 rounded-full border ${
                                    textColor === color ? 'ring-2 ring-blue-500' : ''
                                  }`}
                                  style={{ 
                                    backgroundColor: color,
                                    border: color === '#FFFFFF' ? '1px solid #e5e5e5' : 'none'
                                  }}
                                  title={color}
                                />
                              ))}
                            </div>
                          </div>
                          
                          {/* Text Formatting */}
                          <div className="mb-3">
                            <label className="text-sm text-gray-600 block mb-1">Format</label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateTextStyle('isBold', !isBold)}
                                className={`p-2 rounded ${
                                  isBold ? 'bg-gray-200' : 'hover:bg-gray-100'
                                }`}
                                title="Bold"
                              >
                                <Bold className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleUpdateTextStyle('isItalic', !isItalic)}
                                className={`p-2 rounded ${
                                  isItalic ? 'bg-gray-200' : 'hover:bg-gray-100'
                                }`}
                                title="Italic"
                              >
                                <Italic className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleUpdateTextStyle('textAlign', 'left')}
                                className={`p-2 rounded ${
                                  textAlign === 'left' ? 'bg-gray-200' : 'hover:bg-gray-100'
                                }`}
                                title="Align Left"
                              >
                                <AlignLeft className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleUpdateTextStyle('textAlign', 'center')}
                                className={`p-2 rounded ${
                                  textAlign === 'center' ? 'bg-gray-200' : 'hover:bg-gray-100'
                                }`}
                                title="Align Center"
                              >
                                <AlignCenter className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleUpdateTextStyle('textAlign', 'right')}
                                className={`p-2 rounded ${
                                  textAlign === 'right' ? 'bg-gray-200' : 'hover:bg-gray-100'
                                }`}
                                title="Align Right"
                              >
                                <AlignRight className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Text Actions */}
                          {selectedTextId && (
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() => {
                                  // Start text editing
                                  const selectedText = textElements.find(el => el.id === selectedTextId);
                                  if (selectedText) {
                                    setNewText(selectedText.text);
                                    setIsEditingText(true);
                                  }
                                }}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex-1"
                              >
                                Edit Text
                              </button>
                              <button
                                onClick={() => handleDeleteText(selectedTextId)}
                                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex-1"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {textElements.length === 0 && (
                        <div className="text-center text-gray-500 mt-4">
                          <p>No text elements added yet.</p>
                          <p className="text-sm">Enter text above and click Add to create text on your design.</p>
                        </div>
                      )}
                      
                      {/* Edit Text Modal */}
                      {isEditingText && selectedTextId && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                          <div className="bg-white p-6 rounded-lg max-w-md w-full">
                            <h3 className="text-xl font-semibold mb-4">Edit Text</h3>
                            <input
                              autoFocus
                              type="text"
                              value={newText}
                              onChange={(e) => setNewText(e.target.value)}
                              className="w-full p-3 border rounded mb-4"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setIsEditingText(false)}
                                className="px-4 py-2 border rounded"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  handleEditText(selectedTextId, newText);
                                  setIsEditingText(false);
                                }}
                                className="px-4 py-2 bg-blue-500 text-white rounded"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {activeTab === 'ai' && (
                    <>
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        AI Image Generation
                      </h3>
                      
                      {/* AI Provider Selection */}
                      <div className="mb-4">
                        <label className="text-sm text-gray-600 block mb-2">Choose AI Provider:</label>
                        <div className="flex space-x-4 mb-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="aiProvider"
                              checked={aiProvider === 'openai'}
                              onChange={() => setAiProvider('openai')}
                              className="mr-2"
                            />
                            <span>OpenAI DALL-E</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="aiProvider"
                              checked={aiProvider === 'huggingface'}
                              onChange={() => setAiProvider('huggingface')}
                              className="mr-2"
                            />
                            <span>Hugging Face</span>
                          </label>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <label className="text-sm text-gray-600 block mb-2">
                          Enter a description of the image you want to generate:
                        </label>
                        <div className="flex">
                          <input
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="A beautiful mountain landscape with sunset colors"
                            className="flex-1 p-3 border rounded-l-lg"
                          />
                          <button
                            onClick={handleGenerateImage}
                            disabled={!aiPrompt.trim() || isGeneratingImage}
                            className={`px-4 py-2 rounded-r-lg ${
                              !aiPrompt.trim() || isGeneratingImage
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                                : 'bg-black text-white hover:bg-gray-800'
                            }`}
                          >
                            {isGeneratingImage ? (
                              <span className="flex items-center">
                                <Loader className="w-4 h-4 mr-2 animate-spin" />
                                Generating...
                              </span>
                            ) : (
                              'Generate'
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {/* Provider notes */}
                      <div className="mb-4 text-sm">
                        {aiProvider === 'openai' ? (
                          <div className="p-3 bg-blue-50 text-blue-700 rounded">
                            <p><strong>Note:</strong> OpenAI DALL-E requires an API key with available credits.</p>
                          </div>
                        ) : (
                          <div className="p-3 bg-green-50 text-green-700 rounded">
                            <p><strong>Note:</strong> Hugging Face provides free image generation with a token (requires account signup).</p>
                          </div>
                        )}
                      </div>
                      
                      {isGeneratingImage && (
                        <div className="text-center p-4 border rounded-lg">
                          <Loader className="w-8 h-8 mx-auto mb-2 animate-spin text-gray-400" />
                          <p className="text-gray-600">Generating your image with AI...</p>
                          <p className="text-xs text-gray-500 mt-1">This may take up to 30 seconds</p>
                        </div>
                      )}
                      
                      {aiError && (
                        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                          {aiError}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <button 
                  className={`w-full py-4 rounded-full flex items-center justify-center gap-2 font-medium ${
                    !isInStock() || (!designImage && textElements.length === 0) || !selectedPhoneModel || !selectedCaseType || cartIsLoading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-black text-white hover:bg-gray-800 transition'
                  }`}
                  disabled={!isInStock() || (!designImage && textElements.length === 0) || !selectedPhoneModel || !selectedCaseType || cartIsLoading}
                  onClick={handleAddToCart}
                >
                  {cartIsLoading ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <ShoppingBag className="w-5 h-5" />
                  )}
                  {isEditing ? `Update Design - $${getSelectedCasePrice()}` : `Add to Cart - $${getSelectedCasePrice()}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add 3D Preview Modal */}
      {showing3DPreview && model3DPath && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full h-[80vh] relative">
            <button
              onClick={close3DPreview}
              className="absolute top-4 right-4 p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-xl font-semibold mb-4">3D Preview</h3>
            
            <div className="w-full h-[90%] bg-gray-100 rounded-lg relative overflow-hidden">
              {is3DLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                  <Loader className="w-8 h-8 animate-spin" />
                  <span className="ml-2 text-gray-500">Loading 3D model...</span>
                </div>
              )}
              
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={resetView}
                  className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100"
                  title="Reset View"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
              
              <canvas 
                ref={canvasRef} 
                className="w-full h-full"
              />
              
              <div className="absolute bottom-4 left-0 right-0 text-center text-gray-700 text-sm bg-white/70 py-2 mx-4 rounded-lg">
                <p>Drag to rotate • Scroll to zoom • Right-click to pan</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
