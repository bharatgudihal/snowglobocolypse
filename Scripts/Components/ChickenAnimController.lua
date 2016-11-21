
chickenanimcontroller = 
{
    Properties = 
    {
        FlapInterval = { default = 0.5, description = "How often the chicken flaps.", suffix = " sec" },
        MoveSpeed = { default = 3.0, description = "How fast the chicken moves.", suffix = " m/s" },
        IdlePlaybackSpeed = { default = 1.0, description = "Playback speed for the idle animation." },
        FlapPlaybackSpeed = { default = 1.0, description = "Playback speed for the flap/jump animation." },
        FlapBlendTime = { default = 0.2, description = "Blend time for the flap animation." },
    },
}

function chickenanimcontroller:OnActivate()
    
    self.FlapCountdown = 0.0;

    -- For handling tick events.
    self.tickBusHandler = TickBusHandler(self, 0);
    
    -- For sending events on the SimpleAnimationComponent request bus.
    self.animBusSender = SimpleAnimationComponentRequestBusSender(self.entityId);
    
    -- For sending events to the TransformBus.
    self.transformBusHandler = TransformBusSender(self.entityId);
    
    -- Start by playing the idle animation.
    -- Layer 0, looping, speed=1, no transition time.
    local animInfo = AnimatedLayer("anim_chicken_idle", 0, true, self.Properties.IdlePlaybackSpeed, 0.0);
    self.animBusSender:StartAnimation(animInfo);
    
end

function chickenanimcontroller:OnTick(deltaTime, timePoint)
    
    -- Play the Flap animation FlapInterval seconds. 
    self.FlapCountdown = self.FlapCountdown - deltaTime;
    if (self.FlapCountdown < 0.0) then
        -- Layer 0, non-looping, speed=1, 0.2 transition time.
        -- If the flap were partial body, we could use Layer 1.
        local animInfo = AnimatedLayer("anim_chicken_flapping", 0, false, self.Properties.FlapPlaybackSpeed, self.Properties.FlapBlendTime, true);
        self.animBusSender:StartAnimation(animInfo);
        self.FlapCountdown = self.Properties.FlapInterval;
        --Debug.Log("Played the flap");
    end
     
    -- Get current transform
    local tm = self.transformBusHandler:GetWorldTM();
    
    -- Adjust translation forward at the configured movement speed.
    local forward = tm:GetColumn(1);
    local tx = tm:GetTranslation();
    tx = tx + forward * deltaTime * self.Properties.MoveSpeed;
    tm:SetTranslation(tx);
    
    -- Set our new transform.
    self.transformBusHandler:SetWorldTM(tm);
    
end

function chickenanimcontroller:OnDeactivate()
	self.tickBusHandler:Disconnect();
end

