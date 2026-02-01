'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Upload,
  FileText,
  X,
  BadgeCheck,
  ShieldCheck,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingFooter } from '@/components/onboarding/OnboardingFooter';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import { getTotalSteps, shouldSkipProfileStep } from '@/lib/utils/onboarding';
import { cn } from '@/lib/utils';
import { lawyerVerificationApi, type LawyerProfileDocument } from '@/lib/api/lawyerVerification';
import { toast } from 'sonner';

interface FileUploadProps {
  label: string;
  description: string;
  uploadedDocument: LawyerProfileDocument | null;
  onFileSelect: (file: File) => Promise<void>;
  onFileRemove: () => Promise<void>;
  isUploading: boolean;
  accept?: string;
}

function FileUpload({
  label,
  description,
  uploadedDocument,
  onFileSelect,
  onFileRemove,
  isUploading,
  accept = '.pdf,.jpg,.jpeg,.png',
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!uploadedDocument && !isUploading) {
      inputRef.current?.click();
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      await onFileSelect(selectedFile);
      // Clear input to allow re-upload of same file
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onFileRemove();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition-all min-h-[120px]',
        isUploading && 'cursor-wait opacity-60',
        !uploadedDocument && !isUploading && 'cursor-pointer hover:border-primary/50 hover:bg-primary/5',
        uploadedDocument && 'border-primary bg-primary/5',
        !uploadedDocument && !isUploading && 'border-border'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={isUploading || !!uploadedDocument}
      />
      {isUploading ? (
        <>
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-sm font-medium">Uploading...</span>
        </>
      ) : uploadedDocument ? (
        <>
          <div className="absolute top-2 right-2 rounded-full bg-primary p-1">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
          <FileText className="h-8 w-8 text-primary" />
          <span className="text-xs font-medium truncate max-w-full px-2 text-center">
            {uploadedDocument.original_name}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(uploadedDocument.size)}
          </span>
          <button
            onClick={handleRemove}
            className="absolute bottom-2 right-2 p-1 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground text-center">
            {description}
          </span>
        </>
      )}
    </div>
  );
}

export default function OnboardingStep8Page() {
  const router = useRouter();
  const {
    userType,
    communicationStyle,
    locationData,
    profileData,
    areasOfExpertise,
    verificationData,
    setVerificationData,
    setWantsClientReferrals,
  } = useOnboardingStore();
  const { submitOnboarding, isSubmitting } = useOnboarding();

  // Form state
  const [callNumber, setCallNumber] = useState(verificationData.callNumber || '');
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [profileCreated, setProfileCreated] = useState(!!verificationData.lawyerProfileId);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Check if profile step was skipped
  const skipProfile = shouldSkipProfileStep(
    userType,
    locationData.selectedCountryMatchesDetected || false
  );

  // Create lawyer profile on mount
  useEffect(() => {
    const createProfile = async () => {
      if (profileCreated || isCreatingProfile) return;

      try {
        setIsCreatingProfile(true);
        const response = await lawyerVerificationApi.createProfile();
        setVerificationData({
          lawyerProfileId: response.data.id,
        });
        setProfileCreated(true);
      } catch (error: any) {
        // If profile already exists (403), that's okay
        if (error.response?.status === 403) {
          console.log('[Step 8] Lawyer profile already exists');
          setProfileCreated(true);
        } else {
          console.error('[Step 8] Failed to create lawyer profile:', error);
          toast.error('Failed to initialize verification profile');
        }
      } finally {
        setIsCreatingProfile(false);
      }
    };

    if (userType === 'lawyer' && communicationStyle) {
      createProfile();
    }
  }, [userType, communicationStyle, profileCreated, isCreatingProfile, setVerificationData]);

  // Redirect if previous steps not completed or not a lawyer
  useEffect(() => {
    if (!userType || !communicationStyle) {
      router.replace('/onboarding/step-1');
    } else if (userType !== 'lawyer') {
      router.replace('/onboarding/step-7');
    }
  }, [userType, communicationStyle, router]);

  const handleBack = () => {
    router.push('/onboarding/step-7');
  };

  // File upload handler
  const handleFileUpload = async (file: File, category: string) => {
    if (!profileCreated) {
      toast.error('Please wait while we set up your verification profile');
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size must not exceed 10 MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, JPG, JPEG, and PNG files are allowed');
      return;
    }

    try {
      setUploadingFiles(prev => ({ ...prev, [category]: true }));
      setUploadError(null);

      const response = await lawyerVerificationApi.uploadDocument(file);

      // Add document to store
      setVerificationData({
        uploadedDocuments: [...verificationData.uploadedDocuments, response.data],
      });

      toast.success('Document uploaded successfully');
    } catch (error: any) {
      console.error('[Step 8] Upload failed:', error);
      const message = error.response?.data?.message || 'Failed to upload document';
      toast.error(message);
      setUploadError(message);
    } finally {
      setUploadingFiles(prev => ({ ...prev, [category]: false }));
    }
  };

  // File removal handler
  const handleFileRemove = async (documentId: number) => {
    try {
      await lawyerVerificationApi.deleteDocument(documentId);

      // Remove document from store
      setVerificationData({
        uploadedDocuments: verificationData.uploadedDocuments.filter(
          doc => doc.id !== documentId
        ),
      });

      toast.success('Document removed successfully');
    } catch (error: any) {
      console.error('[Step 8] Delete failed:', error);
      const message = error.response?.data?.message || 'Failed to delete document';
      toast.error(message);
    }
  };

  const handleVerify = async () => {
    if (!profileCreated) {
      toast.error('Please wait while we set up your verification profile');
      return;
    }

    if (verificationData.uploadedDocuments.length === 0) {
      toast.error('Please upload at least one document');
      return;
    }

    try {
      // Submit for verification
      await lawyerVerificationApi.submitForVerification();

      // Save call number
      setVerificationData({ callNumber });
      setWantsClientReferrals(true);

      // Complete onboarding
      submitOnboarding({
        userType: userType!,
        communicationStyle: communicationStyle!,
        ...locationData,
        ...profileData,
        areasOfExpertise,
        callNumber,
        wantsClientReferrals: true,
      });
    } catch (error: any) {
      console.error('[Step 8] Verification submission failed:', error);
      const message = error.response?.data?.message || 'Failed to submit for verification';
      toast.error(message);
    }
  };

  const handleSkip = () => {
    setWantsClientReferrals(false);

    // Complete onboarding without verification
    submitOnboarding({
      userType: userType!,
      communicationStyle: communicationStyle!,
      ...locationData,
      ...profileData,
      areasOfExpertise,
      wantsClientReferrals: false,
    });
  };

  // Helper to get uploaded document by original name pattern
  const getUploadedDocument = (pattern: RegExp): LawyerProfileDocument | null => {
    return verificationData.uploadedDocuments.find(doc =>
      pattern.test(doc.original_name.toLowerCase())
    ) || null;
  };

  const hasAnyDocument = verificationData.uploadedDocuments.length > 0 || callNumber;

  if (!userType || userType !== 'lawyer') {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start p-4 pt-8 pb-24 md:justify-center md:pb-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress
          currentStep={skipProfile ? 6 : 7}
          totalSteps={getTotalSteps(userType, profileData.profession, skipProfile)}
        />

        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3">
                <BadgeCheck className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Want clients to find you?
            </h1>
            <p className="text-muted-foreground">
              Get verified to receive client referrals from Lawexa
            </p>
          </div>

          {/* Verification benefits */}
          <div className="bg-primary/5 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Verified badge on your profile</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Get matched with potential clients</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Build trust with your credentials</span>
            </div>
          </div>

          {/* Loading state while creating profile */}
          {isCreatingProfile ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Setting up your verification profile...</p>
            </div>
          ) : (
            <>
              {/* Error message */}
              {uploadError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Verification form */}
              <div className="space-y-4">
                {/* Call Number */}
                <div className="space-y-2">
                  <Label htmlFor="callNumber">Call Number / Enrollment Number (Optional)</Label>
                  <Input
                    id="callNumber"
                    value={callNumber}
                    onChange={(e) => setCallNumber(e.target.value)}
                    placeholder="e.g., SCN/12345"
                    disabled={isSubmitting}
                  />
                </div>

                {/* File uploads - 2x2 grid */}
                <div className="grid grid-cols-2 gap-3">
                  <FileUpload
                    label="Means of ID"
                    description="NIN, Passport, etc."
                    uploadedDocument={verificationData.uploadedDocuments[0] || null}
                    onFileSelect={(file) => handleFileUpload(file, 'id')}
                    onFileRemove={() => verificationData.uploadedDocuments[0] && handleFileRemove(verificationData.uploadedDocuments[0].id)}
                    isUploading={uploadingFiles['id'] || false}
                  />
                  <FileUpload
                    label="Call to Bar Certificate"
                    description="PDF or Image"
                    uploadedDocument={verificationData.uploadedDocuments[1] || null}
                    onFileSelect={(file) => handleFileUpload(file, 'certificate')}
                    onFileRemove={() => verificationData.uploadedDocuments[1] && handleFileRemove(verificationData.uploadedDocuments[1].id)}
                    isUploading={uploadingFiles['certificate'] || false}
                  />
                  <FileUpload
                    label="Practicing License"
                    description="Current license"
                    uploadedDocument={verificationData.uploadedDocuments[2] || null}
                    onFileSelect={(file) => handleFileUpload(file, 'license')}
                    onFileRemove={() => verificationData.uploadedDocuments[2] && handleFileRemove(verificationData.uploadedDocuments[2].id)}
                    isUploading={uploadingFiles['license'] || false}
                  />
                  <FileUpload
                    label="CV / Resume"
                    description="PDF format"
                    uploadedDocument={verificationData.uploadedDocuments[3] || null}
                    onFileSelect={(file) => handleFileUpload(file, 'cv')}
                    onFileRemove={() => verificationData.uploadedDocuments[3] && handleFileRemove(verificationData.uploadedDocuments[3].id)}
                    isUploading={uploadingFiles['cv'] || false}
                    accept=".pdf"
                  />
                </div>

                {/* Upload status */}
                {verificationData.uploadedDocuments.length > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm text-primary">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>
                      {verificationData.uploadedDocuments.length} document{verificationData.uploadedDocuments.length !== 1 ? 's' : ''} uploaded
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Action buttons - Custom layout for verification */}
          {!isCreatingProfile && (
            <>
              <div className="hidden md:block space-y-3">
                <Button
                  onClick={handleVerify}
                  disabled={!hasAnyDocument || isSubmitting || Object.values(uploadingFiles).some(Boolean)}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="mr-2 h-4 w-4" />
                  )}
                  Get Verified
                </Button>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    disabled={isSubmitting || Object.values(uploadingFiles).some(Boolean)}
                    className="flex-1"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    disabled={isSubmitting || Object.values(uploadingFiles).some(Boolean)}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Skip for now
                  </Button>
                </div>
              </div>

              {/* Mobile footer */}
              <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 md:hidden">
                <div className="max-w-lg mx-auto space-y-3">
                  <Button
                    onClick={handleVerify}
                    disabled={!hasAnyDocument || isSubmitting || Object.values(uploadingFiles).some(Boolean)}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="mr-2 h-4 w-4" />
                    )}
                    Get Verified
                  </Button>
                  <div className="flex gap-3">
                    <Button
                      variant="ghost"
                      onClick={handleBack}
                      disabled={isSubmitting || Object.values(uploadingFiles).some(Boolean)}
                      className="flex-1"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSkip}
                      disabled={isSubmitting || Object.values(uploadingFiles).some(Boolean)}
                      className="flex-1"
                    >
                      Skip for now
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          <p className="text-xs text-muted-foreground text-center">
            You can complete verification later from your profile settings
          </p>
        </div>
      </div>
    </div>
  );
}
