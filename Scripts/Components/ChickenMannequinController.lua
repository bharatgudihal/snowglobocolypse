
chickenmannequincontroller = 
{
    Properties = 
    {
        MoveSpeed = { default = 3.0, description = "How fast the chicken moves.", suffix = " m/s" },
        RotationSpeed = { default = 360.0, description = "How fast (in degrees per second) the chicken can turn.", suffix = " deg/sec"},
        CameraFollowDistance = {default = 5.0, description = "Distance (in meters) from which camera follows character."},
        CameraFollowHeight = {default = 1.0, description = "Height (in meters) from which camera follows character."},        
        CameraLerpSpeed = {default = 5.0, description = "Coefficient for how tightly camera follows character."},
        Camera = {entity = ""},
    },
    
    InputActions = 
    {
        Jump = {}, 
        NavForwardBack = {},
        NavLeftRight = {},
    },
}

function chickenmannequincontroller:OnActivate()
    
    self.InputValues = {};
    self.InputValues.ForwardMagnitude = 0.0;
    self.InputValues.RightMagnitude = 0.0;
    
    -- For per-frame update event.
    self.tickBusHandler = TickBusHandler(self, 0);
    
    -- For rotating the chicken around.
    self.transformBusSender = TransformBusSender(self.entityId);
    
    -- For requesting character movement.
    self.physicsSender = CryCharacterPhysicsRequestBusSender(self.entityId);
    
    -- For talking to the mannequin component.
    self.mannequinSender = MannequinRequestsBusSender(self.entityId);
    
    -- For getting the camera's transform.
    self.cameraTransformSender = TransformBusSender(self.Properties.Camera);
    
    -- For sending physics requests.
    self.physicsSender = CryCharacterPhysicsRequestBusSender(self.entityId);
    
    -- Bind input/gameplay events to event handlers.
    self:BindInputEvent("Jump", self.InputActions.Jump);
    self:BindInputEvent("NavForwardBack", self.InputActions.NavForwardBack);
    self:BindInputEvent("NavLeftRight", self.InputActions.NavLeftRight);
    
    -- Queue persistent Idle fragment.
    self.idleRequest = self.mannequinSender:QueueFragment(1, "Idle", "", true);
end

function chickenmannequincontroller:OnTick(deltaTime, timePoint)

    local moveLocal = Vector3(self.InputValues.NavLeftRight, self.InputValues.NavForwardBack, 0);
        
    if (moveLocal:GetLengthSq() > 0.01) then    

        local tm = self.transformBusSender:GetWorldTM();
        
        -- Apply camera-relative movement on XY plane.
        -- This isn't 100% ideal math, but good enough for this example.
        local cameraOrientation = self.cameraTransformSender:GetWorldTM();
        cameraOrientation:SetTranslation(Vector3(0,0,0));
        local moveMag = moveLocal:GetLength();
        if (moveMag > 1.0) then 
            moveMag = 1.0 
        end

        local moveWorld = cameraOrientation * moveLocal;
        moveWorld.z = 0;
        moveWorld:NormalizeSafe();
        moveWorld = moveWorld * moveMag;
        
        -- Align to movement direction.
        local facing = tm:GetColumn(1):GetNormalized();
        local desiredFacing = moveWorld;
        local dot = facing:Dot(desiredFacing);
        if (dot > 1.0) then
            dot = 1.0;
        end
        if (dot < -1.0) then
            dot = -1.0;
        end
        local angleDelta = Math.ArcCos(dot);
        local rotationRate = self.Properties.RotationSpeed;
        local thisFrame = angleDelta * rotationRate * deltaTime;
        if (angleDelta > FloatEpsilon) then
            if (thisFrame > angleDelta) then 
                thisFrame = angleDelta;
            end
            local side = Math.Sign(facing:Cross(desiredFacing).z);
            if (side < 0.0) then
                thisFrame = -thisFrame;
            end
            local rotationTm = Transform.CreateRotationZ(thisFrame);
            tm = tm * rotationTm;
            tm:Orthogonalize();
            self.transformBusSender:SetWorldTM(tm);            
        end
        
        -- Request movement from character physics.
        local vel = (tm:GetColumn(1) * moveMag * self.Properties.MoveSpeed);
        self.physicsSender:Move(vel, 0);
        
        -- Make sure the nav fragment is playing.
        self.navRequest = self:EnsureFragmentPlaying(self.navRequest, 2, "Nav", "", false);        
    else
    
        self.physicsSender:Move(Vector3(0,0,0), 0);
    
        -- Make sure the nav fragment is not playing.
        self.navRequest = self:EnsureFragmentStopped(self.navRequest);
    end
    
    self:UpdateCamera(deltaTime);
end

function chickenmannequincontroller:UpdateCamera(deltaTime)
    
    -- Movement is camera relative, so camera just follows from a fixed distance.
    local characterTm = self.transformBusSender:GetWorldTM();    
    local followFrom = characterTm:GetTranslation() - Vector3(0, self.Properties.CameraFollowDistance, 0);
    followFrom.z = followFrom.z + self.Properties.CameraFollowHeight;
    
    local cameraTm = self.cameraTransformSender:GetWorldTM();
    local lerpPct = self.Properties.CameraLerpSpeed * deltaTime;
    if (lerpPct > 1.0) then
        lerpPct = 1.0;
    end
    cameraTm:SetTranslation(cameraTm:GetTranslation():Lerp(followFrom, lerpPct));
    
    self.cameraTransformSender:SetWorldTM(cameraTm);
     
end

function chickenmannequincontroller:OnDeactivate()
    for k, v in pairs(self.InputActions) do
        v = {};
    end
   
    self.tickBusHandler:Disconnect();
end

function chickenmannequincontroller:EnsureFragmentPlaying(requestId, priority, fragmentName, fragmentTags, isPersistent)
    if (requestId) then
        local status = self.mannequinSender:GetRequestStatus(requestId);
        if (status == 1 or status == 2) then
            return requestId;
        end
    end
    
    return self.mannequinSender:QueueFragment(priority, fragmentName, fragmentTags, isPersistent);
end

function chickenmannequincontroller:EnsureFragmentStopped(requestId)
    if (requestId) then
        self.mannequinSender:StopRequest(requestId);
    end
    return nil;
end

function chickenmannequincontroller.InputActions.Jump:OnGameplayEventAction(value)
    self.Component.jumpRequest = self.Component:EnsureFragmentPlaying(self.Component.jumpRequest, 3, "Jump", "", false);
end

function chickenmannequincontroller.InputActions.NavForwardBack:OnGameplayEventAction(value)
    self.Component.InputValues.NavForwardBack = value;
end

function chickenmannequincontroller.InputActions.NavForwardBack:OnGameplayEventFailed()
    self.Component.InputValues.NavForwardBack = 0.0;
end

function chickenmannequincontroller.InputActions.NavLeftRight:OnGameplayEventAction(value)
    self.Component.InputValues.NavLeftRight = value;
end

function chickenmannequincontroller.InputActions.NavLeftRight:OnGameplayEventFailed()
    self.Component.InputValues.NavLeftRight = 0.0;
end

function chickenmannequincontroller:BindInputEvent(eventName, inputHandlerTable)
    inputHandlerTable.Listener = FloatGameplayNotificationBusHandler(inputHandlerTable, GameplayNotificationId(self.entityId, eventName));
    inputHandlerTable.Component = self;
end
