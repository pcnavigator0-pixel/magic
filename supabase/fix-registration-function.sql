-- Drop existing function if it exists
DROP FUNCTION IF EXISTS complete_player_registration(TEXT, TEXT, TEXT, UUID);

-- Create improved function that handles edge cases
CREATE OR REPLACE FUNCTION complete_player_registration(
  p_registration_code TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_auth_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_player_id UUID;
  v_is_registered BOOLEAN;
  v_existing_auth_user_id UUID;
BEGIN
  -- Find player by registration code (case-insensitive)
  SELECT id, is_registered, auth_user_id 
  INTO v_player_id, v_is_registered, v_existing_auth_user_id
  FROM players
  WHERE LOWER(registration_code) = LOWER(p_registration_code)
  LIMIT 1;

  -- Check if player exists
  IF v_player_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Code "' || p_registration_code || '" not found in our system. Please check the code and try again.'
    );
  END IF;

  -- Check if already registered with different auth user
  IF v_is_registered AND v_existing_auth_user_id IS NOT NULL AND v_existing_auth_user_id != p_auth_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This registration code has already been used. Contact your coach for a new code.'
    );
  END IF;

  -- Check if this auth_user_id is already linked to a different player
  IF p_auth_user_id IS NOT NULL THEN
    PERFORM 1 FROM players 
    WHERE auth_user_id = p_auth_user_id 
    AND id != v_player_id
    LIMIT 1;
    
    IF FOUND THEN
      RETURN json_build_object(
        'success', false,
        'error', 'This account is already linked to another player. Please contact support.'
      );
    END IF;
  END IF;

  -- Update player record
  UPDATE players
  SET 
    full_name = p_full_name,
    email = p_email,
    auth_user_id = p_auth_user_id,
    is_registered = true,
    updated_at = now()
  WHERE id = v_player_id;

  -- Return success with player data
  RETURN json_build_object(
    'success', true,
    'player', json_build_object(
      'id', v_player_id,
      'full_name', p_full_name,
      'email', p_email,
      'is_registered', true,
      'auth_user_id', p_auth_user_id
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to anon role
GRANT EXECUTE ON FUNCTION complete_player_registration(TEXT, TEXT, TEXT, UUID) TO anon;
