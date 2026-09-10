import type { Request, Response } from 'express';
import {
  generateDailyAdvisory,
  executeAiCampaign,
  getAiAutoPilotSettings,
  updateAiAutoPilotSettings,
  getAiCampaignHistory,
  getSeasonalContext,
} from './ai-marketing.service.js';

/**
 * GET /api/marketing/ai/settings
 */
export const getSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await getAiAutoPilotSettings();
    const season = getSeasonalContext();
    return res.status(200).json({ success: true, settings, season });
  } catch (error: any) {
    console.error('[AI Marketing] Get settings error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * PUT /api/marketing/ai/settings
 */
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { enabled, dailyTime, channels } = req.body || {};
    const updated = await updateAiAutoPilotSettings({ enabled, dailyTime, channels });
    return res.status(200).json({ success: true, settings: updated });
  } catch (error: any) {
    console.error('[AI Marketing] Update settings error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/marketing/ai/preview
 * Body: { productId?: string, targetAudience?: 'customers' | 'dealers' | 'all' }
 */
export const previewAdvisory = async (req: Request, res: Response) => {
  try {
    const { productId, targetAudience } = req.body || {};
    const advisory = await generateDailyAdvisory({ productId, targetAudience });
    return res.status(200).json({ success: true, advisory });
  } catch (error: any) {
    console.error('[AI Marketing] Preview advisory error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/marketing/ai/broadcast
 * Body: {
 *   advisory?: GeneratedAdvisory,
 *   targetAudience?: 'customers' | 'dealers' | 'all',
 *   testNumbers?: string[],
 *   sendPush?: boolean,
 *   sendWhatsApp?: boolean
 * }
 */
export const triggerCampaign = async (req: Request, res: Response) => {
  try {
    const { advisory, targetAudience, testNumbers, sendPush, sendWhatsApp } = req.body || {};
    const adminUserId = (req as any).user?._id || (req as any).user?.id;

    const result = await executeAiCampaign({
      triggerType: 'manual',
      advisory,
      targetAudience,
      testNumbers,
      sendPush: sendPush !== undefined ? sendPush : true,
      sendWhatsApp: sendWhatsApp !== undefined ? sendWhatsApp : true,
      adminUserId: adminUserId ? String(adminUserId) : undefined,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[AI Marketing] Trigger campaign error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/marketing/ai/history?page=1&limit=15
 */
export const getHistory = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 15;
    const history = await getAiCampaignHistory(page, limit);
    return res.status(200).json({ success: true, ...history });
  } catch (error: any) {
    console.error('[AI Marketing] History error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
