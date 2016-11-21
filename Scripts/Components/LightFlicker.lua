
lightflicker = 
{
    Properties = 
    {
        FlickerInterval = 1.0,
        LightEntity = { entity="", description="Light entity to manipulate."},
    },
}

function lightflicker:OnActivate()
    
    self.FlickerCountdown = self.Properties.FlickerInterval;
    local attachToEntity = self.entityId;
    if (self.Properties.LightEntity.id ~= 0) then
        attachToEntity = self.Properties.LightEntity;
    end
    
    Debug.Assert(attachToEntity.id ~= 0, "No entity is attached!");
    
    self.lightBusSender = LightComponentRequestBusSender(attachToEntity);
    self.tickBusHandler = TickBusHandler(self, 0)
    self.lightBusSender:ToggleLight();
    
    --Debug.Log("LightFlicker starting for entity: " .. tostring(attachToEntity.id));
end

function lightflicker:OnTick(deltaTime, timePoint)
    self.FlickerCountdown = self.FlickerCountdown - deltaTime;
    if (self.FlickerCountdown < 0.0) then
        self.lightBusSender:ToggleLight();
        self.FlickerCountdown = self.Properties.FlickerInterval;
    end
end

function lightflicker:OnDeactivate()
	self.tickBusHandler:Disconnect()
end

