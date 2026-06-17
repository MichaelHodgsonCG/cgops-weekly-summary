import { useEffect, useState } from 'react';
import { ClipboardCheck, Upload, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const LOCATION_NAME = 'Test Package';
const TOTAL_STEPS = 1;

type GuidedStep = 'start' | 'boh-labour';

export function GuidedWeeklyPackage() {
  const [step, setStep] = useState<GuidedStep>('start');
  const [locationName, setLocationName] = useState(LOCATION_NAME);
  const [bohLabourFile, setBohLabourFile] = useState<File | null>(null);
  const [bohLabourUploaded, setBohLabourUploaded] = useState(false);

  useEffect(() => {
    loadLocation();
  }, []);

  const loadLocation = async () => {
    const { data } = await supabase
      .from('locations')
      .select('name')
      .eq('name', LOCATION_NAME)
      .maybeSingle();

    if (data) {
      setLocationName(data.name);
    }
  };

  const handleBohLabourSelect = (file: File) => {
    setBohLabourFile(file);
    setBohLabourUploaded(true);
  };

  if (step === 'boh-labour') {
    return (
      <GuidedStepUpload
        stepNumber={1}
        totalSteps={TOTAL_STEPS}
        title="Step 1: Upload BOH Labour Report"
        description="Upload the BOH Labour report exported from your scheduling/timekeeping system."
        file={bohLabourFile}
        uploaded={bohLabourUploaded}
        onFileSelect={handleBohLabourSelect}
        onBack={() => setStep('start')}
      />
    );
  }

  return (
    <GuidedPackageStart
      locationName={locationName}
      onStart={() => setStep('boh-labour')}
    />
  );
}

function GuidedPackageStart({
  locationName,
  onStart,
}: {
  locationName: string;
  onStart: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-slate-800 rounded-lg">
          <ClipboardCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Weekly Culinary Package</h1>
          <p className="text-sm text-slate-500">Guided report upload and review workflow</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Restaurant</p>
          <p className="text-base font-semibold text-slate-800">{locationName}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Reporting Period</p>
          <p className="text-base font-semibold text-slate-800">P11 W2</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Due Date</p>
          <p className="text-base font-semibold text-slate-800">TBD</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Steps</p>
          <p className="text-base font-semibold text-slate-800">Step 0 of {TOTAL_STEPS}</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Progress</span>
          <span>0%</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-slate-800 rounded-full" style={{ width: '0%' }} />
        </div>
      </div>

      <p className="text-slate-600 mt-6 leading-relaxed">
        Welcome Chef. This guided workflow will walk you through each report required for your
        weekly culinary package.
      </p>

      <button
        onClick={onStart}
        className="mt-8 w-full bg-slate-800 text-white font-medium py-3 rounded-lg hover:bg-slate-700 transition-colors"
      >
        Start Package
      </button>
    </div>
  );
}

function GuidedStepUpload({
  stepNumber,
  totalSteps,
  title,
  description,
  file,
  uploaded,
  onFileSelect,
  onBack,
}: {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  file: File | null;
  uploaded: boolean;
  onFileSelect: (file: File) => void;
  onBack: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>Step {stepNumber} of {totalSteps}</span>
        <span>{Math.round((stepNumber / totalSteps) * 100)}%</span>
      </div>
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-slate-800 rounded-full"
          style={{ width: `${(stepNumber / totalSteps) * 100}%` }}
        />
      </div>

      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      <p className="text-slate-600 mt-1">{description}</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`mt-6 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? 'border-slate-800 bg-slate-50' : 'border-slate-300'
        }`}
      >
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-600 mb-3">Drag and drop your report here, or</p>
        <label className="inline-block bg-slate-800 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
          Browse Files
          <input
            type="file"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>

      {uploaded && file && (
        <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">Uploaded: {file.name}</span>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}
