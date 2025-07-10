import { useState } from "react";
import { X, Eye, Loader, Crosshair, Telescope, Camera, Settings, Edit3, Maximize2, Minimize2, Star, MapPin, Monitor, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DeepZoomViewer } from "./deep-zoom-viewer";
import { EquipmentManager } from "./equipment-manager";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { AstroImage, Equipment } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";

interface ImageOverlayProps {
  image: AstroImage;
  onClose: () => void;
}

interface EquipmentWithDetails extends Equipment {
  settings?: any;
  notes?: string;
}

interface DescriptionEditorModalProps {
  image: AstroImage;
  onClose: () => void;
}

function DescriptionEditorModal({ image, onClose }: DescriptionEditorModalProps) {
  const [description, setDescription] = useState(image.description || "");
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiRequest("PATCH", `/api/images/${image.id}`, {
        description: description.trim() || null
      });
      
      // Invalidate and refetch the image data
      await queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      // Also invalidate the specific image query to ensure the overlay gets updated data
      await queryClient.invalidateQueries({ queryKey: ["/api/images", image.id] });
      onClose();
    } catch (error) {
      console.error("Failed to update description:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDescription(image.description || "");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80">
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Edit Description</h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="description" className="text-white">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description for this image..."
              className="mt-2 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
              rows={6}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImageOverlay({ image, onClose }: ImageOverlayProps) {
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [showEquipmentManager, setShowEquipmentManager] = useState(false);
  const [showTechnicalDetailsEditor, setShowTechnicalDetailsEditor] = useState(false);
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [showDescriptionEditor, setShowDescriptionEditor] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const isMobile = useIsMobile();

  // Fetch the latest image data to ensure we have the most up-to-date information
  const { data: currentImage = image } = useQuery({
    queryKey: ["/api/images", image.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/images/${image.id}`);
      return response.json();
    },
    enabled: !!image.id,
    // Use the prop as initial data to avoid loading state
    initialData: image,
  });

  const toggleSection = (sectionName: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  // Fetch annotations only if plate solved and showAnnotations is true
  const { data: annotationsData, isLoading: annotationsLoading } = useQuery({
    queryKey: ["/api/images", currentImage.id, "annotations"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/images/${currentImage.id}/annotations`);
      return response.json();
    },
    enabled: !!(showAnnotations && currentImage.plateSolved),
  });

  // Fetch equipment for this image
  const { data: equipment = [], isLoading: equipmentLoading } = useQuery<EquipmentWithDetails[]>({
    queryKey: ["/api/images", currentImage.id, "equipment"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/images/${currentImage.id}/equipment`);
      return response.json();
    },
    enabled: !!currentImage.id,
  });

  // Fetch plate solving job data for this image
  const { data: plateSolvingJob, isLoading: plateSolvingJobLoading } = useQuery({
    queryKey: ["/api/images", currentImage.id, "plate-solving-job"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/images/${currentImage.id}/plate-solving-job`);
      return response.json();
    },
    enabled: !!(currentImage.id && currentImage.plateSolved),
  });

  // Group equipment by type
  const equipmentByType = equipment.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = [];
    }
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, EquipmentWithDetails[]>);

  const getEquipmentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'telescope':
        return <Telescope className="h-4 w-4" />;
      case 'camera':
        return <Camera className="h-4 w-4" />;
      case 'mount':
        return <Settings className="h-4 w-4" />;
      case 'software':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  if (isMobile) {
    // MOBILE LAYOUT: image on top, details below
    return (
      <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
        {/* Top Navigation Bar */}
        <div className="sticky top-0 z-60 bg-black/80 flex items-center justify-between px-4 py-2 border-b border-black/40">
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-black/60"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded((v) => !v)}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              className="p-2 rounded-full hover:bg-black/60"
            >
              {isExpanded ? <Minimize2 className="h-5 w-5 text-white" /> : <Maximize2 className="h-5 w-5 text-white" />}
            </button>
            {currentImage.plateSolved && (
              <button
                onClick={() => setShowAnnotations((v) => !v)}
                aria-label={showAnnotations ? 'Hide Annotations' : 'Show Annotations'}
                className="p-2 rounded-full hover:bg-black/60 text-white border border-white/20 bg-black/50 disabled:opacity-50"
                disabled={annotationsLoading}
              >
                <Eye className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        <div className="relative w-full max-w-md mx-auto bg-black rounded-b-xl overflow-hidden flex items-center justify-center mt-4" style={{ height: isExpanded ? '100vh' : 'min(50vh, 60vw)' }}>
          {currentImage.immichId ? (
            <div className="relative w-full h-full">
              <DeepZoomViewer
                imageUrl={currentImage.fullUrl || ""}
                annotations={showAnnotations && annotationsData?.annotations ? annotationsData.annotations : []}
                fullHeight={isExpanded}
                height={isExpanded ? '100vh' : '100%'}
                disableZoom={!isExpanded}
              />
            </div>
          ) : (
            <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
              <span className="text-muted-foreground">Image not available</span>
            </div>
          )}
        </div>
        {!isExpanded && (
          <div className="flex flex-col gap-4 bg-card rounded-t-xl max-w-md mx-auto w-full p-4 mt-4">
            {/* Title and Date */}
            <div>
              <h2 className="text-2xl font-bold mb-1 text-foreground">{currentImage.title}</h2>
              <p className="text-sm text-muted-foreground mb-2">
                Captured on {currentImage.captureDate ? new Date(currentImage.captureDate).toLocaleDateString() : "Unknown date"}
              </p>
            </div>
            {/* Equipment Section */}
            <section className="bg-muted/30 rounded-xl p-4 mb-2 shadow border border-black/20">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Telescope className="h-4 w-4" />
                  Equipment Used
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEquipmentManager(true)}
                  className="text-gray-400 hover:text-foreground h-6 px-2"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
              {equipmentLoading ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader className="h-4 w-4 animate-spin" />
                  Loading equipment...
                </div>
              ) : equipment.length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(equipmentByType).map(([type, items]) => (
                    <div key={type} className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 capitalize">{type}</h4>
                      {items.map((item) => (
                        <div key={item.id} className="bg-muted/20 rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="text-sm font-medium text-foreground">{item.name}</h5>
                              {item.description && (
                                <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                              )}
                              {item.settings && Object.keys(item.settings).length > 0 && (
                                <div className="mt-2 text-xs text-gray-700">
                                  <span className="font-medium">Settings:</span>
                                  <div className="mt-1 space-y-1">
                                    {Object.entries(item.settings).map(([key, value]) => (
                                      <div key={key} className="flex justify-between">
                                        <span className="text-gray-500">{key}:</span>
                                        <span>{String(value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {item.notes && (
                                <p className="text-xs text-gray-500 mt-2 italic">"{item.notes}"</p>
                              )}
                            </div>
                            {getEquipmentIcon(type)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-400">
                  <p>No equipment information available.</p>
                  <p className="text-xs mt-1">Click "Edit" to add equipment details.</p>
                </div>
              )}
            </section>
            {/* Technical Details */}
            <section className="bg-muted/30 rounded-xl p-4 mb-2 shadow border border-black/20">
              <h3 className="font-semibold mb-2 text-foreground">Technical Details</h3>
              <div className="text-xs text-muted-foreground space-y-1 font-mono">
                {image.telescope && <div>Telescope: {image.telescope}</div>}
                {image.camera && <div>Camera: {image.camera}</div>}
                {image.mount && <div>Mount: {image.mount}</div>}
                {image.focalLength && <div>Focal Length: {image.focalLength}mm</div>}
                {image.aperture && <div>Aperture: {image.aperture}</div>}
                {image.exposureTime && <div>Exposure: {image.exposureTime}</div>}
                {image.iso && <div>ISO/Gain: {image.iso}</div>}
                {image.frameCount && <div>Frame Count: {image.frameCount}</div>}
                {image.totalIntegration && <div>Total Integration: {image.totalIntegration}h</div>}
                {image.filters && <div>Filters: {image.filters}</div>}
              </div>
            </section>
            {/* Location */}
            {(image.latitude || image.longitude) && (
              <section className="bg-muted/30 rounded-xl p-4 mb-2 shadow border border-black/20">
                <h3 className="font-semibold mb-2 text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </h3>
                <div className="text-xs text-muted-foreground space-y-1 font-mono">
                  {image.latitude && typeof image.latitude === 'number' && <div>Latitude: {image.latitude.toFixed(6)}°</div>}
                  {image.longitude && typeof image.longitude === 'number' && <div>Longitude: {image.longitude.toFixed(6)}°</div>}
                  {image.altitude && <div>Altitude: {image.altitude}m</div>}
                  <div className="mt-2">
                    <a
                      href={`https://www.google.com/maps?q=${image.latitude},${image.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      View on Google Maps
                    </a>
                  </div>
                </div>
              </section>
            )}
            {/* Plate Solution */}
            <section className="bg-muted/30 rounded-xl p-4 mb-2 shadow border border-black/20">
              <h3 className="font-semibold mb-2 text-foreground">Plate Solution</h3>
              {image.plateSolved ? (
                <div className="text-xs text-muted-foreground space-y-1">
                  {image.ra && <div>RA: {image.ra}</div>}
                  {image.dec && <div>Dec: {image.dec}</div>}
                  {image.constellation && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-400" />
                      Constellation: {image.constellation}
                    </div>
                  )}
                  {image.pixelScale && <div>Pixel Scale: {image.pixelScale}"/pixel</div>}
                  {image.fieldOfView && <div>Field of View: {image.fieldOfView}</div>}
                  {image.rotation && <div>Rotation: {image.rotation}°</div>}
                  <div className="text-green-400 flex items-center">
                    {plateSolvingJob?.submissionId ? (
                      <a
                        href={`http://nova.astrometry.net/status/${plateSolvingJob.submissionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        <Badge className="status-plate-solved cursor-pointer hover:bg-green-600">
                          ✓ Verified by Astrometry.net
                        </Badge>
                      </a>
                    ) : (
                      <Badge className="status-plate-solved">✓ Verified by Astrometry.net</Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400">
                  <p>No plate solving data available.</p>
                </div>
              )}
            </section>
            {/* Tags */}
            {image.tags && image.tags.length > 0 && (
              <section className="bg-muted/30 rounded-xl p-4 mb-2 shadow border border-black/20">
                <h3 className="font-semibold mb-2 text-foreground">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {image.tags.map((tag) => (
                    <Badge key={tag} className="astro-tag">
                      {tag}
                    </Badge>
                  ))}
                  {image.objectType && (
                    <Badge className="astro-tag">{image.objectType}</Badge>
                  )}
                </div>
              </section>
            )}
            {/* Description */}
            {image.description && (
              <section className="bg-muted/30 rounded-xl p-4 mb-2 shadow border border-black/20">
                <h3 className="font-semibold mb-2 text-foreground">Description</h3>
                <p className="text-muted-foreground text-sm">{image.description}</p>
              </section>
            )}
          </div>
        )}
                    {/* Equipment Manager Modal */}
            {showEquipmentManager && (
              <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80">
                <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                  <EquipmentManager
                    imageId={currentImage.id}
                    onClose={() => setShowEquipmentManager(false)}
                  />
                </div>
              </div>
            )}
      </div>
    );
  }

  if (isExpanded && !isMobile) {
    // Desktop expanded mode: no top nav, buttons float over image
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="w-screen h-screen flex items-center justify-center">
          <div className="relative w-full h-full">
            <DeepZoomViewer
              imageUrl={image.fullUrl || ""}
              annotations={showAnnotations && annotationsData?.annotations ? annotationsData.annotations : []}
              fullHeight={true}
              height="100vh"
              disableZoom={false}
            />
            {/* Collapse Button (top right) */}
            <div className="absolute top-4 right-4 z-50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="bg-black/50 text-white border-white/20 hover:bg-black/70"
              >
                <Minimize2 className="mr-2 h-4 w-4" />
                Collapse
              </Button>
            </div>
            {/* Show/Hide Annotations Button (bottom right) */}
            {image.plateSolved && (
              <div className="absolute bottom-4 right-4 z-50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnnotations((v) => !v)}
                  className="bg-black/50 text-white border-white/20 hover:bg-black/70"
                  disabled={annotationsLoading}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {showAnnotations ? "Hide" : "Show"} Annotations
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default desktop/tablet layout (not expanded)
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Info panel */}
      {!isExpanded && (
        <aside
          className="w-full max-w-md h-full flex flex-col gap-6 shadow-2xl border-r border-black/60 relative"
          style={{ background: "hsl(217, 86%, 17%)" }} // astro-blue
        >
          {/* Close button */}
          <button
            className="absolute top-6 left-6 z-60 bg-black/70 rounded-full p-2 hover:bg-black/90"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <div className="pt-20 px-8 pb-8 flex-1 flex flex-col gap-6 overflow-y-auto">
            <div>
              <h2 className="text-2xl font-bold mb-1 text-white">{image.title}</h2>
              <p className="text-sm text-gray-300 mb-2">
                Captured on {image.captureDate ? new Date(image.captureDate).toLocaleDateString() : "Unknown date"}
              </p>
            </div>

            {/* Plate Solution - First */}
            <section className="bg-black/30 rounded-xl p-4 mb-2 shadow border border-black/40">
              <button
                onClick={() => toggleSection('plateSolution')}
                className="flex items-center justify-between w-full mb-2"
              >
                <h3 className="font-semibold text-white">Plate Solution</h3>
                {collapsedSections['plateSolution'] ? (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {!collapsedSections['plateSolution'] && (
                <div>
                  {currentImage.plateSolved ? (
                    <div className="text-xs text-gray-300 space-y-1">
                      {currentImage.ra && <div>RA: {currentImage.ra}</div>}
                      {currentImage.dec && <div>Dec: {currentImage.dec}</div>}
                      {currentImage.constellation && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-400" />
                          Constellation: {currentImage.constellation}
                        </div>
                      )}
                      {currentImage.pixelScale && <div>Pixel Scale: {currentImage.pixelScale}"/pixel</div>}
                      {currentImage.fieldOfView && <div>Field of View: {currentImage.fieldOfView}</div>}
                      {currentImage.rotation && <div>Rotation: {currentImage.rotation}°</div>}
                      <div className="text-green-400 flex items-center mt-1">
                        {plateSolvingJob?.submissionId ? (
                          <a
                            href={`http://nova.astrometry.net/status/${plateSolvingJob.submissionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            <Badge className="status-plate-solved cursor-pointer hover:bg-green-600">
                              ✓ Verified by Astrometry.net
                            </Badge>
                          </a>
                        ) : (
                          <Badge className="status-plate-solved">✓ Verified by Astrometry.net</Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">
                      <p>No plate solving data available.</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Technical Details - Second */}
            <section className="bg-black/30 rounded-xl p-4 mb-2 shadow border border-black/40">
              <div className="flex items-center justify-between w-full mb-2">
                <h3 className="font-semibold text-white">Technical Details</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTechnicalDetailsEditor(true)}
                    className="text-gray-400 hover:text-white h-6 px-2"
                    title="Edit Technical Details"
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                  <button
                    onClick={() => toggleSection('technicalDetails')}
                    className="flex items-center hover:opacity-80 transition-opacity"
                  >
                    {collapsedSections['technicalDetails'] ? (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              {!collapsedSections['technicalDetails'] && (
                <div className="text-xs text-gray-300 space-y-1 font-mono">
                  {currentImage.telescope && <div>Telescope: {currentImage.telescope}</div>}
                  {currentImage.camera && <div>Camera: {currentImage.camera}</div>}
                  {currentImage.mount && <div>Mount: {currentImage.mount}</div>}
                  {currentImage.focalLength && <div>Focal Length: {currentImage.focalLength}mm</div>}
                  {currentImage.aperture && <div>Aperture: {currentImage.aperture}</div>}
                  {currentImage.exposureTime && <div>Exposure: {currentImage.exposureTime}</div>}
                  {currentImage.iso && <div>ISO/Gain: {currentImage.iso}</div>}
                  {currentImage.frameCount && <div>Frame Count: {currentImage.frameCount}</div>}
                  {currentImage.totalIntegration && <div>Total Integration: {currentImage.totalIntegration}h</div>}
                  {currentImage.filters && <div>Filters: {currentImage.filters}</div>}
                </div>
              )}
            </section>

            {/* Equipment Section - Third */}
            <section className="bg-black/30 rounded-xl p-4 mb-2 shadow border border-black/40">
              <div className="flex items-center justify-between w-full mb-2">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Telescope className="h-4 w-4" />
                  Equipment Used
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEquipmentManager(true)}
                    className="text-gray-400 hover:text-white h-6 px-2"
                    title="Edit Equipment"
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                  <button
                    onClick={() => toggleSection('equipment')}
                    className="flex items-center hover:opacity-80 transition-opacity"
                  >
                    {collapsedSections['equipment'] ? (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              {!collapsedSections['equipment'] && (
                <div>
                  {equipmentLoading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader className="h-4 w-4 animate-spin" />
                      Loading equipment...
                    </div>
                  ) : equipment.length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(equipmentByType).map(([type, items]) => (
                        <div key={type} className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-300 capitalize">{type}</h4>
                          {items.map((item) => (
                            <div key={item.id} className="bg-black/20 rounded-lg p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h5 className="text-sm font-medium text-white">{item.name}</h5>
                                  {item.description && (
                                    <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                                  )}
                                  {item.settings && Object.keys(item.settings).length > 0 && (
                                    <div className="mt-2 text-xs text-gray-300">
                                      <span className="font-medium">Settings:</span>
                                      <div className="mt-1 space-y-1">
                                        {Object.entries(item.settings).map(([key, value]) => (
                                          <div key={key} className="flex justify-between">
                                            <span className="text-gray-400">{key}:</span>
                                            <span>{String(value)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {item.notes && (
                                    <p className="text-xs text-gray-400 mt-2 italic">"{item.notes}"</p>
                                  )}
                                </div>
                                {getEquipmentIcon(type)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">
                      <p>No equipment information available.</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Location - Fourth */}
            {(currentImage.latitude || currentImage.longitude) && (
              <section className="bg-black/30 rounded-xl p-4 mb-2 shadow border border-black/40">
                              <div className="flex items-center justify-between w-full mb-2">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLocationEditor(true)}
                    className="text-gray-400 hover:text-white h-6 px-2"
                    title="Edit Location"
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                  <button
                    onClick={() => toggleSection('location')}
                    className="flex items-center hover:opacity-80 transition-opacity"
                  >
                    {collapsedSections['location'] ? (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
                {!collapsedSections['location'] && (
                  <div className="text-xs text-gray-300 space-y-1 font-mono">
                    {currentImage.latitude && typeof currentImage.latitude === 'number' && <div>Latitude: {currentImage.latitude.toFixed(6)}°</div>}
                    {currentImage.longitude && typeof currentImage.longitude === 'number' && <div>Longitude: {currentImage.longitude.toFixed(6)}°</div>}
                    {currentImage.altitude && <div>Altitude: {currentImage.altitude}m</div>}
                    <div className="mt-2">
                      <a
                        href={`https://www.google.com/maps?q=${currentImage.latitude},${currentImage.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        View on Google Maps
                      </a>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Description - Fifth */}
            <section className="bg-black/30 rounded-xl p-4 mb-2 shadow border border-black/40">
              <div className="flex items-center justify-between w-full mb-2">
                <h3 className="font-semibold text-white">Description</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDescriptionEditor(true)}
                    className="text-gray-400 hover:text-white h-6 px-2"
                    title="Edit Description"
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                  <button
                    onClick={() => toggleSection('description')}
                    className="flex items-center hover:opacity-80 transition-opacity"
                  >
                    {collapsedSections['description'] ? (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              {!collapsedSections['description'] && (
                <div>
                  {currentImage.description ? (
                    <p className="text-gray-300 text-sm">{currentImage.description}</p>
                  ) : (
                    <p className="text-gray-500 text-sm italic">No description added yet. Click the edit button to add one.</p>
                  )}
                </div>
              )}
            </section>

            {/* Tags - Sixth */}
            {image.tags && image.tags.length > 0 && (
              <section className="bg-black/30 rounded-xl p-4 mb-2 shadow border border-black/40">
                <button
                  onClick={() => toggleSection('tags')}
                  className="flex items-center justify-between w-full mb-2"
                >
                  <h3 className="font-semibold text-white">Tags</h3>
                  {collapsedSections['tags'] ? (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                {!collapsedSections['tags'] && (
                  <div className="flex flex-wrap gap-2">
                    {image.tags.map((tag) => (
                      <Badge key={tag} className="astro-tag">
                        {tag}
                      </Badge>
                    ))}
                    {image.objectType && (
                      <Badge className="astro-tag">{image.objectType}</Badge>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        </aside>
      )}
      <main className={`flex items-center justify-center bg-black flex-1`}>
        {image.immichId ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <DeepZoomViewer
              imageUrl={image.fullUrl || ""}
              annotations={showAnnotations && annotationsData?.annotations ? annotationsData.annotations : []}
              fullHeight={false}
              height="100%"
              disableZoom={true}
            />
            {/* Show/Hide Annotations Button (desktop/tablet, not expanded) */}
            {image.plateSolved && (
              <div className="absolute bottom-4 right-4 z-10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnnotations((v) => !v)}
                  className="bg-black/50 text-white border-white/20 hover:bg-black/70"
                  disabled={annotationsLoading}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {showAnnotations ? "Hide" : "Show"} Annotations
                </Button>
              </div>
            )}
            {/* Expand Button (desktop/tablet, not expanded) */}
            <div className="absolute top-4 right-4 z-10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(true)}
                className="bg-black/50 text-white border-white/20 hover:bg-black/70"
              >
                <Maximize2 className="mr-2 h-4 w-4" />
                Expand
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">Image not available</span>
          </div>
        )}
      </main>
      {/* Equipment Manager Modal - Desktop */}
      {showEquipmentManager && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80">
          <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <EquipmentManager
              imageId={image.id}
              onClose={() => setShowEquipmentManager(false)}
            />
          </div>
        </div>
      )}

      {/* Technical Details Editor Modal */}
      {showTechnicalDetailsEditor && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80">
          <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Edit Technical Details</h2>
              <button
                onClick={() => setShowTechnicalDetailsEditor(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="text-white">
              <p>Technical Details Editor - Coming Soon</p>
              <p className="text-sm text-gray-400 mt-2">
                This will allow editing of telescope, camera, mount, focal length, aperture, exposure time, ISO/gain, frame count, total integration, and filters.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Location Editor Modal */}
      {showLocationEditor && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80">
          <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Edit Location</h2>
              <button
                onClick={() => setShowLocationEditor(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="text-white">
              <p>Location Editor - Coming Soon</p>
              <p className="text-sm text-gray-400 mt-2">
                This will allow editing of latitude, longitude, and altitude coordinates.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Description Editor Modal */}
      {showDescriptionEditor && (
        <DescriptionEditorModal
          image={currentImage}
          onClose={() => setShowDescriptionEditor(false)}
        />
      )}
    </div>
  );
} 