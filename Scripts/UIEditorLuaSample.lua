
uieditorluasample = 
{
    Properties = 
    {
    },
}

function uieditorluasample:OnActivate()
    self.uiCanvasLuaProxy = UiCanvasLuaProxy();
    local canvasEntityId = self.uiCanvasLuaProxy:LoadCanvas("Levels/Samples/UIEditor_Lua_Sample/UI/UiLuaSample.uicanvas");
    self.uiCanvasLuaProxy:BusConnect(canvasEntityId);
    self.uiCanvasLuaBusSender = UiCanvasLuaBusSender(canvasEntityId);

    -- Listen for action strings broadcast by the canvas
    self.uiCanvasNotificationLuaProxy = UiCanvasNotificationLuaProxy();
    self.uiCanvasNotificationLuaProxy:BusConnect(canvasEntityId);
    self.uiCanvasNotificationLuaBusHandler = UiCanvasNotificationLuaBusHandler(self, canvasEntityId);

    -- Display the mouse cursor
    LyShineLua.ShowMouseCursor(true);
end

function uieditorluasample:OnAction(entityId, actionName)
    Debug.Log(entityId.id .. ": " .. actionName);

    if actionName ~= "PlayGame" then
        return;
    end

    -- We know that the canvas we're targeting has an element with an ID of 2
    -- that contains a Fader component.
    local entityWithFader = self.uiCanvasLuaBusSender:FindElementById(2);
    
    if UiFaderComponent.HasFaderHandler(entityWithFader) == false then
        Debug.Log("Error: no Fader component found for " .. entityId.id);
        return;
    end

    self.uiFaderBusSender = UiFaderBusSender(entityWithFader);
    self.uiFaderBusSender:SetFadeValue(1.0);
    self.uiFaderBusSender:Fade(0.0, 1);

    -- Entering "gameplay", so hide the cursor
    LyShineLua.ShowMouseCursor(false);
end

function uieditorluasample:OnDeactivate()
    self.uiCanvasNotificationLuaBusHandler:Disconnect();
end

