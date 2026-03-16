'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileUpload,
  FileUploadTrigger,
  FileUploadContent,
} from '@/components/ui/file-upload';

import { useImportAkn } from '@/lib/hooks/useAdminStatutes';
import { useCountries } from '@/lib/hooks/useAdminCases';
import { extractApiError } from '@/lib/utils/api-error';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/******************************************************************************
                                Component Props
******************************************************************************/

interface StatuteImportUploadProps {
  onImportStarted: (uuid: string) => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

export function StatuteImportUpload({ onImportStarted }: StatuteImportUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [countryId, setCountryId] = useState<string>('');

  const importMutation = useImportAkn();
  const { data: countriesData } = useCountries({ per_page: 100 });
  const countries = countriesData?.data || [];

  const handleFilesAdded = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      toast.error('Only XML files are accepted');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be under 50MB');
      return;
    }

    setSelectedFile(file);
  }, []);

  const handleSubmit = () => {
    if (!selectedFile) {
      toast.error('Please select an XML file');
      return;
    }

    importMutation.mutate(
      {
        file: selectedFile,
        title: title || undefined,
        year: year ? parseInt(year) : undefined,
        country_id: countryId ? parseInt(countryId) : undefined,
      },
      {
        onSuccess: (response) => {
          toast.success(response.message || 'Import started');
          onImportStarted(response.data.id);
          // Reset form
          setSelectedFile(null);
          setTitle('');
          setYear('');
          setCountryId('');
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          toast.error(apiError.message);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import AKN XML
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Selection */}
        <div className="space-y-2">
          <Label>XML File</Label>
          <FileUpload
            onFilesAdded={handleFilesAdded}
            multiple={false}
            accept=".xml"
            disabled={importMutation.isPending}
          >
            {selectedFile ? (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  disabled={importMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <FileUploadTrigger asChild>
                <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer hover:bg-muted/30 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to select or drag &amp; drop an XML file
                  </p>
                  <p className="text-xs text-muted-foreground">Max 50MB</p>
                </div>
              </FileUploadTrigger>
            )}
            <FileUploadContent>
              <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-primary/5 p-8">
                <Upload className="h-12 w-12 text-primary" />
                <p className="text-lg font-medium text-primary">Drop XML file here</p>
              </div>
            </FileUploadContent>
          </FileUpload>
        </div>

        {/* Optional Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="import-title">Title Override</Label>
            <Input
              id="import-title"
              placeholder="Auto-detected from XML"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={importMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-year">Year Override</Label>
            <Input
              id="import-year"
              type="number"
              placeholder="Auto-detected"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={1800}
              max={new Date().getFullYear()}
              disabled={importMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Country</Label>
            <Select
              value={countryId || 'none'}
              onValueChange={(val) => setCountryId(val === 'none' ? '' : val)}
              disabled={importMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {countries.map((country) => (
                  <SelectItem key={country.id} value={String(country.id)}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!selectedFile || importMutation.isPending}
          className="w-full sm:w-auto"
        >
          {importMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Start Import
        </Button>
      </CardContent>
    </Card>
  );
}
