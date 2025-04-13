import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Type definitions
interface CaseType {
  id: number;
  name: string;
  price: number;
  image_url: string | null;
}

interface InventorySummary {
  caseTypeId: number;
  totalAvailable: number;
}

interface PhoneModel {
  id: string;
  name: string;
  brand: string;
}

interface GroupedCases {
  [brand: string]: {
    models: PhoneModel[];
    cases: {
      [caseType: string]: CaseType[];
    };
  };
}

// Constants
const FALLBACK_CASE_IMAGE = "https://images.unsplash.com/photo-1606041011872-596597976b25?auto=format&fit=crop&q=80";
const BRANDS = ['iPhone', 'Samsung', 'Google Pixel'];
const CASE_TYPES = ['Tough Case', 'Clear Case', 'Silicone Case', 'Leather Case', 'MagSafe Case'];
const CUSTOMIZABLE_CASE_TYPES = ['Tough Case', 'Silicone Case', 'Clear Case'];
const DIRECT_BUY_CASE_TYPES = ['Leather Case', 'MagSafe Case'];

// Helper function to check if an image exists
const imageExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export function Home() {
  const [popularCases, setPopularCases] = useState<CaseType[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary[]>([]);
  const [phoneModels, setPhoneModels] = useState<PhoneModel[]>([]);
  const [groupedCases, setGroupedCases] = useState<GroupedCases>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseImageMap, setCaseImageMap] = useState<Record<number, string>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        
        // Fetch popular case types
        const { data: casesData, error: casesError } = await supabase
          .from('case_types')
          .select('*')
          .order('id');
        
        if (casesError) throw casesError;
        
        // Fetch inventory summary
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory_items')
          .select('case_type_id, quantity');
        
        if (inventoryError) throw inventoryError;
        
        // Fetch phone models for generating image paths
        const { data: phonesData, error: phonesError } = await supabase
          .from('phone_models')
          .select('*')
          .eq('active', true);
        
        if (phonesError) throw phonesError;
        
        // Process phone models to add brand information
        const processedPhoneModels = phonesData?.map(model => {
          let brand = 'Other';
          
          if (model.name.includes('iPhone')) {
            brand = 'iPhone';
          } else if (model.name.includes('Samsung')) {
            brand = 'Samsung';
          } else if (model.name.includes('Pixel')) {
            brand = 'Google Pixel';
          }
          
          return {
            ...model,
            brand
          };
        }) || [];
        
        setPhoneModels(processedPhoneModels);
        
        // Group cases by brand and type
        const grouped: GroupedCases = {};
        
        // Initialize the structure
        BRANDS.forEach(brand => {
          grouped[brand] = {
            models: [],
            cases: {}
          };
          
          // Initialize case types
          CASE_TYPES.forEach(caseType => {
            grouped[brand].cases[caseType] = [];
          });
        });
        
        // Populate models by brand
        processedPhoneModels.forEach(model => {
          if (grouped[model.brand]) {
            grouped[model.brand].models.push(model);
          }
        });
        
        // Associate cases with models
        if (casesData) {
          casesData.forEach(caseType => {
            // For each brand, if the case type is in our target list, add it
            BRANDS.forEach(brand => {
              if (CASE_TYPES.includes(caseType.name) && grouped[brand]) {
                grouped[brand].cases[caseType.name] = [...(grouped[brand].cases[caseType.name] || []), caseType];
              }
            });
          });
        }
        
        setGroupedCases(grouped);
        
        // Calculate inventory summary
        const summary: InventorySummary[] = [];
        inventoryData?.forEach(item => {
          const existingSummary = summary.find(s => s.caseTypeId === item.case_type_id);
          if (existingSummary) {
            existingSummary.totalAvailable += item.quantity;
          } else {
            summary.push({
              caseTypeId: item.case_type_id,
              totalAvailable: item.quantity
            });
          }
        });
        
        // Create a map of case types to Clear Case images
        const imageMap: Record<number, string> = {};
        
        // For each case type, try to find a Clear Case image
        if (casesData && phonesData) {
          const clearCaseType = casesData.find(c => c.name === 'Clear Case');
          
          if (clearCaseType) {
            // Try with the first iPhone model
            const iPhoneModel = phonesData.find(p => p.name.includes('iPhone'));
            
            if (iPhoneModel) {
              for (const caseType of casesData) {
                // Check if a clear case image exists for this iPhone model
                const imagePath = `/phone_case/Clear_Case/${iPhoneModel.name.replace(/\s+/g, '_')}.png`;
                if (await imageExists(imagePath)) {
                  imageMap[caseType.id] = imagePath;
                }
              }
            }
          }
        }
        
        setCaseImageMap(imageMap);
        setPopularCases(casesData || []);
        setInventorySummary(summary);
      } catch (err: any) {
        console.error('Error fetching data:', err.message);
        setError('Failed to load case collection. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, []);

  // Function to get the appropriate image URL for a case
  const getCaseImageUrl = (caseItem: CaseType, brand: string = '', deviceName: string = ''): string => {
    // If brand and device name are provided, check specific path first
    if (brand && deviceName && caseItem.name) {
      const specificPath = `/phone_case/${brand}/${deviceName.replace(/\s+/g, '_')}/${caseItem.name.replace(/\s+/g, '_')}.png`;
      // We would check if this exists, but for now we'll just use the map or fallback
    }
    
    // First check if we have a mapped Clear Case image
    if (caseImageMap[caseItem.id]) {
      return caseImageMap[caseItem.id];
    }
    
    // Otherwise, use the case's own image or fallback
    return caseItem.image_url || FALLBACK_CASE_IMAGE;
  };

  // Check if a case type has inventory available
  const isCaseAvailable = (caseTypeId: number): boolean => {
    const inventoryItem = inventorySummary.find(item => item.caseTypeId === caseTypeId);
    return inventoryItem !== undefined && inventoryItem.totalAvailable > 0;
  };

  // Check if a case type is customizable
  const isCaseCustomizable = (caseTypeName: string): boolean => {
    return CUSTOMIZABLE_CASE_TYPES.includes(caseTypeName);
  };

  // Check if a case type should use direct buy
  const isDirectBuyCase = (caseTypeName: string): boolean => {
    return DIRECT_BUY_CASE_TYPES.includes(caseTypeName);
  };

  return (
    <>
      {/* Hero Section */}
      <section className="pt-20">
        <div className="relative h-[80vh] w-full">
          <img 
            src="https://images.unsplash.com/photo-1559819774-c4542a473681?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt="Hero"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="text-center text-white">
              <h2 className="text-5xl font-bold mb-4">Premium Phone Cases</h2>
              <p className="text-xl mb-8">Protect your device in style</p>
              <Link 
                to="/custom-design"
                className="bg-white text-black px-8 py-3 rounded-full hover:bg-gray-100 transition inline-block"
              >
                Design Your Case
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Collection */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Featured Collection</h2>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center max-w-3xl mx-auto">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader className="animate-spin h-8 w-8 text-black" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
              {popularCases.slice(0, 6).map((caseItem) => (
                <div key={caseItem.id} className="group cursor-pointer">
                  <div className="relative overflow-hidden">
                    <img 
                      src={getCaseImageUrl(caseItem)}
                      alt={caseItem.name}
                      className="w-full aspect-[3/4] object-cover transition group-hover:scale-105"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = FALLBACK_CASE_IMAGE;
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm p-4 translate-y-full group-hover:translate-y-0 transition">
                      {isCaseAvailable(caseItem.id) && isCaseCustomizable(caseItem.name) ? (
                        <Link 
                          to={`/custom-design?caseType=${encodeURIComponent(caseItem.name)}`}
                          className="block w-full bg-black text-white py-2 rounded-full hover:bg-gray-800 transition text-center"
                        >
                          Customize
                        </Link>
                      ) : isCaseAvailable(caseItem.id) && isDirectBuyCase(caseItem.name) ? (
                        <Link 
                          to={`/payment?caseType=${encodeURIComponent(caseItem.name)}`}
                          className="block w-full bg-indigo-600 text-white py-2 rounded-full hover:bg-indigo-700 transition text-center"
                        >
                          Buy Now
                        </Link>
                      ) : isCaseAvailable(caseItem.id) ? (
                        <Link 
                          to={`/products?caseType=${encodeURIComponent(caseItem.name)}`}
                          className="block w-full bg-black text-white py-2 rounded-full hover:bg-gray-800 transition text-center"
                        >
                          View Details
                        </Link>
                      ) : (
                        <button 
                          className="w-full bg-gray-300 text-gray-500 py-2 rounded-full cursor-not-allowed"
                          disabled
                        >
                          Out of Stock
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <h4 className="text-lg font-medium">{caseItem.name}</h4>
                    <div className="flex justify-between items-center">
                      <p className="text-gray-600">${caseItem.price.toFixed(2)}</p>
                      {!isCaseAvailable(caseItem.id) && (
                        <span className="text-xs text-red-600 font-medium">Out of Stock</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Brand-Specific Collections */}
          {!isLoading && (
            <>
              {/* iPhone Cases */}
              <div className="mb-16">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold">iPhone Cases</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                  {CASE_TYPES.map(caseTypeName => {
                    const caseType = groupedCases['iPhone']?.cases[caseTypeName]?.[0];
                    if (!caseType) return null;
                    
                    // Try to get an iPhone model to use for the image
                    const model = groupedCases['iPhone']?.models[0];
                    const modelName = model?.name || '';
                    
                    return (
                      <div key={`iphone-${caseTypeName}`} className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
                        <div className="aspect-square overflow-hidden">
                          <img 
                            src={getCaseImageUrl(caseType, 'iPhone', modelName)}
                            alt={`iPhone ${caseTypeName}`}
                            className="w-full h-full object-cover transition group-hover:scale-105"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = FALLBACK_CASE_IMAGE;
                            }}
                          />
                        </div>
                        <div className="p-4">
                          <h4 className="font-medium">{caseTypeName}</h4>
                          <div className="flex justify-between items-center mt-1">
                            <p className="text-sm text-gray-600">${caseType.price.toFixed(2)}</p>
                            {isCaseCustomizable(caseTypeName) ? (
                              <Link 
                                to={`/custom-design?caseType=${encodeURIComponent(caseTypeName)}`}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Customize
                              </Link>
                            ) : isDirectBuyCase(caseTypeName) ? (
                              <Link 
                                to={`/payment?caseType=${encodeURIComponent(caseTypeName)}&brand=iPhone&model=${encodeURIComponent(modelName)}`}
                                className="text-xs text-indigo-600 hover:underline font-medium"
                              >
                                Buy
                              </Link>
                            ) : (
                              <Link 
                                to={`/products?caseType=${encodeURIComponent(caseTypeName)}`}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                View
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Samsung Cases */}
              <div className="mb-16">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold">Samsung Cases</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                  {CASE_TYPES.map(caseTypeName => {
                    const caseType = groupedCases['Samsung']?.cases[caseTypeName]?.[0];
                    if (!caseType) return null;
                    
                    // Try to get a Samsung model to use for the image
                    const model = groupedCases['Samsung']?.models[0];
                    const modelName = model?.name || '';
                    
                    return (
                      <div key={`samsung-${caseTypeName}`} className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
                        <div className="aspect-square overflow-hidden">
                          <img 
                            src={getCaseImageUrl(caseType, 'Samsung', modelName)}
                            alt={`Samsung ${caseTypeName}`}
                            className="w-full h-full object-cover transition group-hover:scale-105"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = FALLBACK_CASE_IMAGE;
                            }}
                          />
                        </div>
                        <div className="p-4">
                          <h4 className="font-medium">{caseTypeName}</h4>
                          <div className="flex justify-between items-center mt-1">
                            <p className="text-sm text-gray-600">${caseType.price.toFixed(2)}</p>
                            {isCaseCustomizable(caseTypeName) ? (
                              <Link 
                                to={`/custom-design?caseType=${encodeURIComponent(caseTypeName)}`}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Customize
                              </Link>
                            ) : isDirectBuyCase(caseTypeName) ? (
                              <Link 
                                to={`/payment?caseType=${encodeURIComponent(caseTypeName)}&brand=Samsung&model=${encodeURIComponent(modelName)}`}
                                className="text-xs text-indigo-600 hover:underline font-medium"
                              >
                                Buy
                              </Link>
                            ) : (
                              <Link 
                                to={`/products?caseType=${encodeURIComponent(caseTypeName)}`}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                View
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Google Pixel Cases */}
              <div className="mb-16">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold">Google Pixel Cases</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                  {CASE_TYPES.map(caseTypeName => {
                    const caseType = groupedCases['Google Pixel']?.cases[caseTypeName]?.[0];
                    if (!caseType) return null;
                    
                    // Try to get a Pixel model to use for the image
                    const model = groupedCases['Google Pixel']?.models[0];
                    const modelName = model?.name || '';
                    
                    return (
                      <div key={`pixel-${caseTypeName}`} className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
                        <div className="aspect-square overflow-hidden">
                          <img 
                            src={getCaseImageUrl(caseType, 'Google Pixel', modelName)}
                            alt={`Google Pixel ${caseTypeName}`}
                            className="w-full h-full object-cover transition group-hover:scale-105"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = FALLBACK_CASE_IMAGE;
                            }}
                          />
                        </div>
                        <div className="p-4">
                          <h4 className="font-medium">{caseTypeName}</h4>
                          <div className="flex justify-between items-center mt-1">
                            <p className="text-sm text-gray-600">${caseType.price.toFixed(2)}</p>
                            {isCaseCustomizable(caseTypeName) ? (
                              <Link 
                                to={`/custom-design?caseType=${encodeURIComponent(caseTypeName)}`}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Customize
                              </Link>
                            ) : isDirectBuyCase(caseTypeName) ? (
                              <Link 
                                to={`/payment?caseType=${encodeURIComponent(caseTypeName)}&brand=Google%20Pixel&model=${encodeURIComponent(modelName)}`}
                                className="text-xs text-indigo-600 hover:underline font-medium"
                              >
                                Buy
                              </Link>
                            ) : (
                              <Link 
                                to={`/products?caseType=${encodeURIComponent(caseTypeName)}`}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                View
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Collection Banner */}
      <section className="py-16 bg-gray-100">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-3xl font-bold mb-4">Premium Protection</h3>
              <p className="text-gray-600 mb-6">Our cases are crafted from the highest quality materials, providing exceptional protection while maintaining a slim profile.</p>
              <Link 
                to="/custom-design"
                className="bg-black text-white px-6 py-3 rounded-full hover:bg-gray-800 transition inline-block"
              >
                Explore Custom Designs
              </Link>
            </div>
            <div className="relative">
              <img 
                src="https://cdn.thewirecutter.com/wp-content/media/2024/10/BEST-IPHONE-16-CASES-2048px-4833-2x1-1.jpg?width=2048&quality=75&crop=2:1&auto=webp"
                alt="Premium Cases"
                className="rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
