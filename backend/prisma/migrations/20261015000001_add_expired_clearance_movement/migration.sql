-- Add EXPIRED_CLEARANCE value to movement_type enum
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'EXPIRED_CLEARANCE';
