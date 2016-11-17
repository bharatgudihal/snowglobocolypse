
#pragma once

#include <IGameRulesSystem.h>

namespace LYGame
{
    class snowglobocolypseGameRules
        : public CGameObjectExtensionHelper < snowglobocolypseGameRules, IGameRules >
    {
    public:
        snowglobocolypseGameRules() {}
        virtual ~snowglobocolypseGameRules();

        //////////////////////////////////////////////////////////////////////////
        //! IGameObjectExtension
        bool Init(IGameObject* pGameObject) override;
        void PostInit(IGameObject* pGameObject) override;
        void ProcessEvent(SEntityEvent& event) override { }
        //////////////////////////////////////////////////////////////////////////

        //////////////////////////////////////////////////////////////////////////
        // IGameRules
        bool OnClientConnect(ChannelId channelId, bool isReset) override;
        //////////////////////////////////////////////////////////////////////////
    };
} // namespace LYGame