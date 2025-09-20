import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Badge } from 'react-bootstrap';
import { 
  STORAGE_TYPES, 
  detectCloudFolders, 
  getStorageConfig, 
  setStorageConfig 
} from '../utils/fileStorage';

const StorageSettings = ({ show, onHide, onStorageChange }) => {
  const [selectedType, setSelectedType] = useState(STORAGE_TYPES.LOCAL);
  const [customPath, setCustomPath] = useState('');
  const [cloudFolders, setCloudFolders] = useState({ icloud: null, googleDrive: null });
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      // Load current configuration
      const currentConfig = getStorageConfig();
      setSelectedType(currentConfig.type);
      setCustomPath(currentConfig.path || '');
      
      // Detect available cloud folders
      const detected = detectCloudFolders();
      setCloudFolders(detected);
      setError('');
    }
  }, [show]);

  const handleSave = () => {
    setError('');

    try {
      const newConfig = {
        type: selectedType,
        path: selectedType === STORAGE_TYPES.CUSTOM ? customPath : null
      };

      // Validate configuration
      if (selectedType === STORAGE_TYPES.CUSTOM && !customPath.trim()) {
        setError('Please enter a custom folder path');
        return;
      }

      if (selectedType === STORAGE_TYPES.ICLOUD && !cloudFolders.icloud) {
        setError('iCloud Drive not detected on this system');
        return;
      }

      if (selectedType === STORAGE_TYPES.GOOGLE_DRIVE && !cloudFolders.googleDrive) {
        setError('Google Drive not detected on this system');
        return;
      }

      // Apply the configuration
      setStorageConfig(newConfig);
      
      // Notify parent component
      if (onStorageChange) {
        onStorageChange(newConfig);
      }

      onHide();
    } catch (err) {
      setError(`Error saving settings: ${err.message}`);
    }
  };

  const getStorageDescription = (type) => {
    switch (type) {
      case STORAGE_TYPES.LOCAL:
        return 'Store data locally in the application data folder';
      case STORAGE_TYPES.ICLOUD:
        return 'Store data in iCloud Drive for automatic sync across devices';
      case STORAGE_TYPES.GOOGLE_DRIVE:
        return 'Store data in Google Drive for automatic sync across devices';
      case STORAGE_TYPES.CUSTOM:
        return 'Store data in a custom folder of your choice';
      default:
        return '';
    }
  };

  const isStorageAvailable = (type) => {
    switch (type) {
      case STORAGE_TYPES.ICLOUD:
        return cloudFolders.icloud !== null;
      case STORAGE_TYPES.GOOGLE_DRIVE:
        return cloudFolders.googleDrive !== null;
      default:
        return true;
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Storage Settings</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Storage Location</Form.Label>
            <p className="text-muted small">
              Choose where to store your portfolio data. Cloud storage options enable automatic sync across devices.
            </p>
            
            <div className="d-flex flex-column gap-2">
              <Form.Check
                type="radio"
                id="storage-local"
                name="storageType"
                label={
                  <div>
                    <strong>Local Storage</strong>
                    <div className="text-muted small">
                      {getStorageDescription(STORAGE_TYPES.LOCAL)}
                    </div>
                  </div>
                }
                checked={selectedType === STORAGE_TYPES.LOCAL}
                onChange={() => setSelectedType(STORAGE_TYPES.LOCAL)}
              />

              <Form.Check
                type="radio"
                id="storage-icloud"
                name="storageType"
                disabled={!isStorageAvailable(STORAGE_TYPES.ICLOUD)}
                label={
                  <div className="d-flex align-items-center gap-2">
                    <div>
                      <strong>iCloud Drive</strong>
                      {!isStorageAvailable(STORAGE_TYPES.ICLOUD) && (
                        <Badge bg="secondary" className="ms-2">Not Available</Badge>
                      )}
                      <div className="text-muted small">
                        {getStorageDescription(STORAGE_TYPES.ICLOUD)}
                        {cloudFolders.icloud && (
                          <div className="mt-1">
                            <code>{cloudFolders.icloud}/PortfolioRebalancer</code>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                }
                checked={selectedType === STORAGE_TYPES.ICLOUD}
                onChange={() => setSelectedType(STORAGE_TYPES.ICLOUD)}
              />

              <Form.Check
                type="radio"
                id="storage-gdrive"
                name="storageType"
                disabled={!isStorageAvailable(STORAGE_TYPES.GOOGLE_DRIVE)}
                label={
                  <div className="d-flex align-items-center gap-2">
                    <div>
                      <strong>Google Drive</strong>
                      {!isStorageAvailable(STORAGE_TYPES.GOOGLE_DRIVE) && (
                        <Badge bg="secondary" className="ms-2">Not Available</Badge>
                      )}
                      <div className="text-muted small">
                        {getStorageDescription(STORAGE_TYPES.GOOGLE_DRIVE)}
                        {cloudFolders.googleDrive && (
                          <div className="mt-1">
                            <code>{cloudFolders.googleDrive}/PortfolioRebalancer</code>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                }
                checked={selectedType === STORAGE_TYPES.GOOGLE_DRIVE}
                onChange={() => setSelectedType(STORAGE_TYPES.GOOGLE_DRIVE)}
              />

              <Form.Check
                type="radio"
                id="storage-custom"
                name="storageType"
                label={
                  <div>
                    <strong>Custom Folder</strong>
                    <div className="text-muted small">
                      {getStorageDescription(STORAGE_TYPES.CUSTOM)}
                    </div>
                  </div>
                }
                checked={selectedType === STORAGE_TYPES.CUSTOM}
                onChange={() => setSelectedType(STORAGE_TYPES.CUSTOM)}
              />
            </div>

            {selectedType === STORAGE_TYPES.CUSTOM && (
              <Form.Group className="mt-3">
                <Form.Label>Custom Folder Path</Form.Label>
                <Form.Control
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="/path/to/your/portfolio/data"
                />
                <Form.Text className="text-muted">
                  Enter the full path to the folder where you want to store portfolio data
                </Form.Text>
              </Form.Group>
            )}
          </Form.Group>

          <Alert variant="info" className="mb-0">
            <strong>Note:</strong> Changing storage location will not automatically migrate existing data. 
            Use the backup/restore feature to transfer data between storage locations.
          </Alert>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save Settings
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default StorageSettings;