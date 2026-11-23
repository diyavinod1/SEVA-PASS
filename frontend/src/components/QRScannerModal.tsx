import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Keyboard,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  SwitchCamera
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (result: { qr_payload?: string; pass_code?: string; scanned_vehicle_reg?: string }) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanResult
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual' | 'demo'>('camera');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [camerasList, setCamerasList] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const [manualCode, setManualCode] = useState('');
  const [scannedPlate, setScannedPlate] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'seva-dedicated-qr-container';

  // Stop camera stream safely
  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error while stopping camera scanner:', err);
      } finally {
        html5QrCodeRef.current = null;
        setIsCameraActive(false);
        setIsStartingCamera(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen || activeTab !== 'camera') {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const startCameraScanning = async (overrideCameraId?: string) => {
    setIsStartingCamera(true);
    setCameraError(null);

    // Stop existing scanner if any
    await stopCamera();

    try {
      // 1. Enumerate available cameras
      let availableCameras: Array<{ id: string; label: string }> = [];
      try {
        availableCameras = await Html5Qrcode.getCameras();
        setCamerasList(availableCameras);
      } catch (camErr) {
        console.warn('getCameras failed or not supported:', camErr);
      }

      // 2. Instantiate scanner on the dedicated empty div
      const scanner = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      html5QrCodeRef.current = scanner;

      // 3. Success handler
      const onScanSuccess = async (decodedText: string) => {
        try {
          await stopCamera();
        } catch (e) {
          console.warn('Cleanup error on scan success:', e);
        }
        onScanResult({
          qr_payload: decodedText,
          scanned_vehicle_reg: scannedPlate ? scannedPlate.trim() : undefined
        });
        onClose();
      };

      // 4. Scanner config with adaptive sizing
      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const edge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(180, Math.floor(edge * 0.72));
          return { width: size, height: size };
        },
        aspectRatio: 1.333333
      };

      // 5. Determine camera to use
      let cameraConfig: any = { facingMode: 'environment' };

      const chosenId = overrideCameraId || selectedCameraId;
      if (chosenId) {
        cameraConfig = chosenId;
      } else if (availableCameras.length > 0) {
        // If mobile with back camera, choose back; on Mac/laptop choose the available camera
        const backCam = availableCameras.find((c) =>
          c.label.toLowerCase().includes('back') ||
          c.label.toLowerCase().includes('rear') ||
          c.label.toLowerCase().includes('environment')
        );
        const targetCam = backCam || availableCameras[0];
        cameraConfig = targetCam.id;
        setSelectedCameraId(targetCam.id);
      }

      // Try starting with chosen camera
      try {
        await scanner.start(cameraConfig, config, onScanSuccess, () => {});
        setIsCameraActive(true);
      } catch (firstAttemptErr) {
        console.warn('First camera start attempt failed, attempting fallback { facingMode: "user" }:', firstAttemptErr);
        // Fallback for laptops / desktop webcams that don't support back/environment camera
        await scanner.start({ facingMode: 'user' }, config, onScanSuccess, () => {});
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.error('Fatal camera start failure:', err);
      setCameraError(
        err.message || 'Camera permission denied or camera unavailable. Please check browser permissions, or use image upload / manual pass code entry.'
      );
      setIsCameraActive(false);
    } finally {
      setIsStartingCamera(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setFileError(null);

    try {
      const html5QrCode = new Html5Qrcode('file-scanner-temp-isolated', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      const decodedText = await html5QrCode.scanFile(file, true);
      await html5QrCode.clear();

      onScanResult({
        qr_payload: decodedText,
        scanned_vehicle_reg: scannedPlate ? scannedPlate.trim() : undefined
      });
      onClose();
    } catch (err: any) {
      setFileError('Could not find a valid QR code in the uploaded image. Please try another image or manual code entry.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onScanResult({
      pass_code: manualCode.trim().toUpperCase(),
      scanned_vehicle_reg: scannedPlate ? scannedPlate.trim() : undefined
    });
    onClose();
  };

  const handleQuickDemo = (code: string, vehicle?: string) => {
    onScanResult({
      pass_code: code,
      scanned_vehicle_reg: vehicle
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-[#CBD5E1] shadow-elevated overflow-hidden">
        {/* Header */}
        <div className="bg-[#14243A] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#B99A62]">
              <ShieldCheck className="w-5 h-5 text-[#B99A62]" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Pass Verification Scanner</h3>
              <p className="text-[11px] text-[#94A3B8]">Public Cryptographic QR & Plate Check</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Methods Tabs */}
        <div className="flex border-b border-[#E2E8F0] bg-[#F7F7F3] p-1.5 text-xs font-medium gap-1">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${
              activeTab === 'camera'
                ? 'bg-white text-[#14243A] font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${
              activeTab === 'upload'
                ? 'bg-white text-[#14243A] font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${
              activeTab === 'manual'
                ? 'bg-white text-[#14243A] font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A]'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Pass Code</span>
          </button>
          {(import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true') && (
            <button
              onClick={() => setActiveTab('demo')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${
                activeTab === 'demo'
                  ? 'bg-white text-[#B99A62] font-semibold shadow-xs'
                  : 'text-[#64748B] hover:text-[#14243A]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#B99A62]" />
              <span>Test Passes</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Optional Lane Vehicle Plate Input for Optical Match */}
          <div className="p-3 rounded-xl bg-[#F7F7F3] border border-[#E2E8F0]">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
              Vehicle Plate (Optional Cross-Match)
            </label>
            <input
              type="text"
              placeholder="e.g. 21D 104523X"
              value={scannedPlate}
              onChange={(e) => setScannedPlate(e.target.value.toUpperCase())}
              className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5E1] text-xs font-mono font-semibold uppercase focus:outline-hidden focus:border-[#14243A] bg-white"
            />
            <p className="text-[10px] text-[#94A3B8] mt-1">
              Cross-matches the observed physical plate against the digitally signed pass record.
            </p>
          </div>

          {/* TAB 1: CAMERA */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              {/* Camera Scanner Viewport */}
              <div className="relative w-full min-h-[280px] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                {/* 
                  IMPORTANT: This element is dedicated strictly to Html5Qrcode.
                  React must NEVER render children directly inside this container to prevent DOM reconciliation conflicts.
                */}
                <div id={scannerContainerId} className="w-full h-full min-h-[280px]" />

                {/* Overlays rendered as absolute siblings OUTSIDE the scanner container */}
                {!isCameraActive && (
                  <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
                    {isStartingCamera ? (
                      <>
                        <RefreshCw className="w-8 h-8 text-[#B99A62] animate-spin mx-auto" />
                        <p className="text-xs text-slate-300 font-medium">
                          Initialising camera video stream...
                        </p>
                      </>
                    ) : (
                      <>
                        <Camera className="w-10 h-10 text-[#B99A62] mx-auto opacity-80" />
                        <p className="text-xs text-slate-300 max-w-xs mx-auto">
                          Click below to start your device camera and scan the pass QR code.
                        </p>
                        <button
                          type="button"
                          onClick={() => startCameraScanning()}
                          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#B99A62] text-[#0C1728] hover:bg-[#CEB482] transition-colors shadow-xs"
                        >
                          Start Camera Scanning
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Camera Controls Bar (when camera is active) */}
              {isCameraActive && (
                <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium text-emerald-800">Camera active • Aim at QR code</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {camerasList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const currentIndex = camerasList.findIndex((c) => c.id === selectedCameraId);
                          const nextCam = camerasList[(currentIndex + 1) % camerasList.length];
                          setSelectedCameraId(nextCam.id);
                          startCameraScanning(nextCam.id);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#14243A] hover:underline"
                      >
                        <SwitchCamera className="w-3.5 h-3.5 text-[#B99A62]" />
                        <span>Switch Camera</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-[#14243A]"
                    >
                      Stop Camera
                    </button>
                  </div>
                </div>
              )}

              {/* Error Notice */}
              {cameraError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C44747] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Camera Notice:</span>
                    <span>{cameraError}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: IMAGE UPLOAD */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[#CBD5E1] rounded-xl p-8 text-center hover:border-[#14243A] transition-colors bg-[#F7F7F3]">
                <Upload className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                <p className="text-xs font-semibold text-[#14243A] mb-1">
                  Upload Pass QR Code Image
                </p>
                <p className="text-[11px] text-[#64748B] mb-4">
                  PNG, JPG or Screenshot of the digital pass QR code
                </p>
                <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#14243A] text-white cursor-pointer hover:bg-[#0C1728] transition-colors shadow-xs">
                  <span>Browse Image File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isProcessingFile}
                  />
                </label>
              </div>

              <div id="file-scanner-temp-isolated" className="hidden" />

              {isProcessingFile && (
                <div className="flex items-center justify-center gap-2 text-xs text-[#64748B]">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#B99A62]" />
                  <span>Scanning image for QR payload...</span>
                </div>
              )}

              {fileError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C44747] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{fileError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANUAL PASS CODE */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1.5">
                  SEVA PASS Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. SEVA-2026-WC-1045"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#CBD5E1] text-sm font-mono font-semibold uppercase focus:outline-hidden focus:border-[#14243A]"
                  autoFocus
                />
                <p className="text-[11px] text-[#64748B] mt-1">
                  Enter the 16-character reference code from the pass card.
                </p>
              </div>

              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] disabled:opacity-50 transition-colors shadow-xs"
              >
                Verify Pass Code
              </button>
            </form>
          )}

          {/* TAB 4: DEMO TEST PASSES */}
          {activeTab === 'demo' && (
            <div className="space-y-2.5">
              <p className="text-xs text-[#64748B]">
                Click any preloaded test scenario to verify live without needing a camera:
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemo('SEVA-2026-WC-1045', '21D 104523X')}
                  className="w-full p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 transition-colors text-left flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block font-mono">
                      SEVA-2026-WC-1045 (Valid Active Pass)
                    </span>
                    <span className="text-[11px] text-emerald-700">
                      Western Command • Vehicle 21D 104523X
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-200 text-emerald-800">
                    Test Valid
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemo('SEVA-2026-WC-3341')}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-left flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800 block font-mono">
                      SEVA-2026-WC-3341 (Expired Test Pass)
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Validity ended on 2026-11-20
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                    Test Expired
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemo('SEVA-2026-NC-7765')}
                  className="w-full p-2.5 rounded-xl border border-red-200 bg-red-50/60 hover:bg-red-100/80 transition-colors text-left flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-red-900 block font-mono">
                      SEVA-2026-NC-7765 (Revoked Pass)
                    </span>
                    <span className="text-[11px] text-red-700">
                      Cancelled due to road closure
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-200 text-red-800">
                    Test Revoked
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemo('SEVA-2026-WC-1045', 'DL01-INCORRECT-9999')}
                  className="w-full p-2.5 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/80 transition-colors text-left flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-amber-900 block font-mono">
                      Vehicle Mismatch Simulation
                    </span>
                    <span className="text-[11px] text-amber-700">
                      Tests optical plate cross-matching discrepancy
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-200 text-amber-800">
                    Test Mismatch
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
