import { nanoid } from "nanoid";
import type { Msg, Reply } from "../ui-shared/messaging";
import {
  listProfileIndex,
  getProfile,
  setActiveProfile,
  getActiveProfileId,
  upsertProfile,
  deleteProfile,
  setProfileComputedSkills
} from "../storage/profiles";
import {
  readAlertSettings,
  writeAlertSettings
} from "../storage/alert-settings";
import { checkAndNotify } from "./reminder-engine";
import {
  createCollection,
  listCollections,
  renameCollection,
  deleteCollection,
  addJDItem,
  listJDItems,
  getJDItem,
  removeJDItem,
  upsertItemEmbedding,
  updateCollectionKeywords,
  updateJDItemTags,
  updateJDItemSkills,
  updateJDItemGap
} from "../db/jd.collections";
import { db } from "../db/db";
import {
  addHistory,
  clearHistory,
  linkHistoryToJobDescription,
  listHistory,
  removeHistory,
  setHistoryNote,
  setHistoryStatus
} from "../db/history";
import type { JDAddItemPayload, HistoryListParams, HistoryLogPayload } from "../ui-shared/messaging";
import {
  buildJobSignature,
  canonicalizeJobUrl,
  hashJobDescription,
  normalizeJobTerm
} from "../ui-shared/jd-normalize";
import type { JDItem } from "../ui-shared/types.jd";

// `chrome.runtime.onMessage` cannot be awaited directly; respond via callback
chrome.runtime.onMessage.addListener((message: Msg, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((reply) => sendResponse(reply))
    .catch((error) => {
      console.error("JobSnap background error", error);
      const reply: Reply = { ok: false, error: error instanceof Error ? error.message : String(error) };
      sendResponse(reply);
    });
  return true; // keep port open for async response
});

async function handleMessage(message: Msg, sender?: chrome.runtime.MessageSender): Promise<Reply> {
  switch (message.type) {
    case "LIST_PROFILE_INDEX": {
      const data = await listProfileIndex();
      return { ok: true, data };
    }
    case "GET_PROFILE": {
      const profile = await getProfile(message.id);
      return profile ? { ok: true, data: profile } : { ok: false, error: "NOT_FOUND" };
    }
    case "GET_ACTIVE_PROFILE": {
      const id = await getActiveProfileId();
      if (!id) {
        return { ok: false, error: "NO_ACTIVE_PROFILE" };
      }
      const profile = await getProfile(id);
      return profile ? { ok: true, data: profile } : { ok: false, error: "NOT_FOUND" };
    }
    case "SET_ACTIVE_PROFILE": {
      await setActiveProfile(message.id);
      return { ok: true };
    }
    case "UPSERT_PROFILE": {
      const next = message.profile.id || nanoid();
      await upsertProfile({ ...message.profile, id: next });
      return { ok: true, data: next };
    }
    case "CREATE_PROFILE": {
      const id = nanoid();
      const now = new Date().toISOString();
      await upsertProfile({
        id,
        name: message.name,
        resume: message.resume,
        updatedAt: now
      });
      return { ok: true, data: id };
    }
    case "DELETE_PROFILE": {
      await deleteProfile(message.id);
      return { ok: true };
    }
    case "IMPORT_FROM_LINKEDIN": {
      try {
        // Get the current tab (sender tab) first, then fallback to querying
        let linkedinTab: chrome.tabs.Tab | undefined;

        if (sender?.tab?.id) {
          // Use the sender tab if it's a LinkedIn profile
          const tab = sender.tab;
          if (tab.url?.includes('linkedin.com') && tab.url.includes('/in/')) {
            linkedinTab = tab;
          }
        }

        // If sender tab is not LinkedIn, query for LinkedIn tabs
        if (!linkedinTab) {
          const tabs = await chrome.tabs.query({ url: "*://*.linkedin.com/in/*" });
          if (tabs.length === 0) {
            return { ok: false, error: "No LinkedIn profile tabs found. Please open a LinkedIn profile page and try again." };
          }
          linkedinTab = tabs[0];
        }

        if (!linkedinTab?.id || !linkedinTab.url) {
          return { ok: false, error: "Unable to access LinkedIn tab." };
        }

        // Extract profile ID from URL
        const profileIdMatch = linkedinTab.url.match(/\/in\/([^/?]+)/);
        if (!profileIdMatch) {
          return { ok: false, error: "Could not extract profile ID from URL." };
        }
        const linkedinProfileId = profileIdMatch[1];

        // Show loading overlay
        await chrome.scripting.executeScript({
          target: { tabId: linkedinTab.id },
          func: showLinkedInImportOverlay,
          args: ['Fetching profile data...']
        });

        // Execute fetch from LinkedIn page context to use cookies
        const results = await chrome.scripting.executeScript({
          target: { tabId: linkedinTab.id },
          func: fetchLinkedInVoyagerProfileInPage,
          args: [linkedinProfileId]
        });

        if (!results || !results[0] || !results[0].result) {
          return { ok: false, error: "Could not fetch profile data from LinkedIn API. You may need to be logged in to LinkedIn." };
        }

        const { success, data, error } = results[0].result;

        let profileData: any = null;
        let usedDOMScraping = false;

        // If Voyager API failed (especially with 410 errors), fallback to DOM scraping
        if (!success || !data) {
          console.log('Voyager API failed, falling back to DOM scraping:', error);

          // Execute DOM scraping in the LinkedIn page context
          const domScraperResults = await chrome.scripting.executeScript({
            target: { tabId: linkedinTab.id },
            func: scrapeLinkedInProfileFromDOM
          });

          if (domScraperResults?.[0]?.result) {
            profileData = domScraperResults[0].result;
            usedDOMScraping = true;
            console.log('Successfully scraped profile from DOM');
          } else {
            return { ok: false, error: error || "Failed to fetch LinkedIn profile via API and DOM scraping" };
          }
        } else {
          // Fetch full skills list (separate API call)
          const skillsResults = await chrome.scripting.executeScript({
            target: { tabId: linkedinTab.id },
            func: fetchLinkedInSkillsInPage,
            args: [linkedinProfileId]
          });

          const skillsData = skillsResults?.[0]?.result?.data;

          // Log all entity types to understand the structure
          const entityTypes = data.included ?
            [...new Set(data.included.map((e: any) => e.$type))].sort() : [];

          console.log('LinkedIn Voyager API response structure:', {
            hasData: !!data.data,
            hasIncluded: !!data.included,
            includedCount: data.included?.length,
            entityTypes: entityTypes,
            dataKeys: data.data ? Object.keys(data.data).slice(0, 10) : []
          });

          // Parse the Voyager response
          profileData = parseLinkedInVoyagerResponse(data, skillsData);
        }

        console.log('Parsed profile data:', {
          name: profileData.basics?.name,
          headline: profileData.basics?.label,
          workCount: profileData.work?.length,
          educationCount: profileData.education?.length,
          skillsCount: profileData.skills?.length
        });

        if (!profileData) {
          return { ok: false, error: "Could not parse profile data from LinkedIn API." };
        }

        // Additional step: Try to get more skills by navigating to the skills detail page
        // Check if we need more skills (if we got very few from the main parsing)
        if (profileData.skills.length < 10) {
          console.log(`Only found ${profileData.skills.length} skills, navigating to skills detail page...`);

          try {
            // Update overlay message
            await chrome.scripting.executeScript({
              target: { tabId: linkedinTab.id },
              func: updateLinkedInImportOverlay,
              args: ['Collecting skills...']
            });

            // Save the current URL to restore later
            const currentUrl = linkedinTab.url;
            const skillsDetailUrl = `https://www.linkedin.com/in/${linkedinProfileId}/details/skills/`;

            // Navigate to the skills detail page
            console.log(`Navigating to: ${skillsDetailUrl}`);
            await chrome.tabs.update(linkedinTab.id, { url: skillsDetailUrl });

            // Wait for the page to fully load by polling for skill items
            console.log('Waiting for skills to load...');
            let skillsLoaded = false;
            let attempts = 0;
            const maxAttempts = 20; // 10 seconds total (20 * 500ms)

            while (!skillsLoaded && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 500));
              attempts++;

              // Re-inject overlay on the new page (it was lost during navigation)
              if (attempts === 1) {
                await chrome.scripting.executeScript({
                  target: { tabId: linkedinTab.id },
                  func: showLinkedInImportOverlay,
                  args: ['Collecting skills...']
                });
              }

              // Check if skills have loaded
              const checkResults = await chrome.scripting.executeScript({
                target: { tabId: linkedinTab.id },
                func: () => {
                  const skillItems = document.querySelectorAll('li.pvs-list__paged-list-item');
                  return skillItems.length;
                }
              });

              const skillCount = checkResults?.[0]?.result || 0;
              console.log(`Attempt ${attempts}: Found ${skillCount} skill items`);

              if (skillCount > 0) {
                skillsLoaded = true;
                console.log('Skills loaded successfully!');
              }
            }

            if (!skillsLoaded) {
              console.log('Skills did not load after 10 seconds, trying to scrape anyway...');
            }

            // Scrape skills from the now-loaded detail page
            const detailSkillsResults = await chrome.scripting.executeScript({
              target: { tabId: linkedinTab.id },
              func: scrapeSkillsFromCurrentPage
            });

            const detailSkillsData = detailSkillsResults?.[0]?.result;
            console.log('Detail skills result:', detailSkillsData);

            if (detailSkillsData?.success && detailSkillsData.skills?.length > 0) {
              console.log(`Found ${detailSkillsData.skills.length} skills from detail page`);

              // Merge scraped skills with existing skills (avoid duplicates)
              const existingSkillNames = new Set(profileData.skills.map((s: any) => s.name));
              const newSkills = detailSkillsData.skills.filter((s: any) => !existingSkillNames.has(s.name));

              // Add new skills to profile
              profileData.skills.push(...newSkills.map((s: any) => ({
                name: s.name,
                level: s.endorsementCount ? `${s.endorsementCount} endorsements` : undefined
              })));

              console.log(`Added ${newSkills.length} new skills from detail page. Total: ${profileData.skills.length}`);
            } else {
              console.log('Could not scrape skills from detail page:', detailSkillsData?.error || 'No result returned');
            }

            // Navigate back to the original profile page
            if (currentUrl) {
              console.log(`Navigating back to: ${currentUrl}`);
              await chrome.tabs.update(linkedinTab.id, { url: currentUrl });
            }
          } catch (err) {
            console.error('Exception while navigating to skills detail page:', err);
          }
        } else {
          console.log(`Already have ${profileData.skills.length} skills from main scraping, skipping detail page`);
        }

        // Additional step: Try to get more certificates by navigating to the certificates detail page
        // Check if we need more certificates (if we got very few from the main parsing)
        if (profileData.certificates.length < 5) {
          console.log(`Only found ${profileData.certificates.length} certificates, navigating to certificates detail page...`);

          try {
            // Update overlay message
            await chrome.scripting.executeScript({
              target: { tabId: linkedinTab.id },
              func: updateLinkedInImportOverlay,
              args: ['Collecting certificates...']
            });

            // Save the current URL to restore later (might have changed from skills navigation)
            const currentUrl2 = linkedinTab.url;
            const certsDetailUrl = `https://www.linkedin.com/in/${linkedinProfileId}/details/certifications/`;

            // Navigate to the certificates detail page
            console.log(`Navigating to: ${certsDetailUrl}`);
            await chrome.tabs.update(linkedinTab.id, { url: certsDetailUrl });

            // Wait for the page to fully load by polling for certificate items
            console.log('Waiting for certificates to load...');
            let certsLoaded = false;
            let attempts2 = 0;
            const maxAttempts2 = 20; // 10 seconds total

            while (!certsLoaded && attempts2 < maxAttempts2) {
              await new Promise(resolve => setTimeout(resolve, 500));
              attempts2++;

              // Re-inject overlay on the new page (it was lost during navigation)
              if (attempts2 === 1) {
                await chrome.scripting.executeScript({
                  target: { tabId: linkedinTab.id },
                  func: showLinkedInImportOverlay,
                  args: ['Collecting certificates...']
                });
              }

              // Check if certificates have loaded
              const checkResults2 = await chrome.scripting.executeScript({
                target: { tabId: linkedinTab.id },
                func: () => {
                  const certItems = document.querySelectorAll('li.pvs-list__paged-list-item');
                  return certItems.length;
                }
              });

              const certCount = checkResults2?.[0]?.result || 0;
              console.log(`Attempt ${attempts2}: Found ${certCount} certificate items`);

              if (certCount > 0) {
                certsLoaded = true;
                console.log('Certificates loaded successfully!');
              }
            }

            if (!certsLoaded) {
              console.log('Certificates did not load after 10 seconds, trying to scrape anyway...');
            }

            // Scrape certificates from the now-loaded detail page
            const detailCertsResults = await chrome.scripting.executeScript({
              target: { tabId: linkedinTab.id },
              func: scrapeCertificatesFromCurrentPage
            });

            const detailCertsData = detailCertsResults?.[0]?.result;
            console.log('Detail certificates result:', detailCertsData);

            if (detailCertsData?.success && detailCertsData.certificates?.length > 0) {
              console.log(`Found ${detailCertsData.certificates.length} certificates from detail page`);

              // Merge scraped certificates with existing ones (avoid duplicates)
              const existingCertNames = new Set(profileData.certificates.map((c: any) => c.name));
              const newCerts = detailCertsData.certificates.filter((c: any) => !existingCertNames.has(c.name));

              // Add new certificates to profile
              profileData.certificates.push(...newCerts);

              console.log(`Added ${newCerts.length} new certificates from detail page. Total: ${profileData.certificates.length}`);
            } else {
              console.log('Could not scrape certificates from detail page:', detailCertsData?.error || 'No result returned');
            }

            // Navigate back to the original profile page
            if (currentUrl2) {
              console.log(`Navigating back to: ${currentUrl2}`);
              await chrome.tabs.update(linkedinTab.id, { url: currentUrl2 });
            }
          } catch (err) {
            console.error('Exception while navigating to certificates detail page:', err);
          }
        } else {
          console.log(`Already have ${profileData.certificates.length} certificates from main scraping, skipping detail page`);
        }

        // Additional step: Try to get more recommendations by navigating to the recommendations detail page
        // Check if we need more recommendations (if we got very few from the main parsing)
        if (profileData.references.length < 3) {
          console.log(`Only found ${profileData.references.length} recommendations, navigating to recommendations detail page...`);

          try {
            // Update overlay message
            await chrome.scripting.executeScript({
              target: { tabId: linkedinTab.id },
              func: updateLinkedInImportOverlay,
              args: ['Collecting recommendations...']
            });

            // Save the current URL to restore later (might have changed from previous navigations)
            const currentUrl3 = linkedinTab.url;
            const recsDetailUrl = `https://www.linkedin.com/in/${linkedinProfileId}/details/recommendations/`;

            // Navigate to the recommendations detail page
            console.log(`Navigating to: ${recsDetailUrl}`);
            await chrome.tabs.update(linkedinTab.id, { url: recsDetailUrl });

            // Wait for the page to fully load by polling for recommendation items
            console.log('Waiting for recommendations to load...');
            let recsLoaded = false;
            let attempts3 = 0;
            const maxAttempts3 = 20; // 10 seconds total

            while (!recsLoaded && attempts3 < maxAttempts3) {
              await new Promise(resolve => setTimeout(resolve, 500));
              attempts3++;

              // Re-inject overlay on the new page (it was lost during navigation)
              if (attempts3 === 1) {
                await chrome.scripting.executeScript({
                  target: { tabId: linkedinTab.id },
                  func: showLinkedInImportOverlay,
                  args: ['Collecting recommendations...']
                });
              }

              // Check if recommendations have loaded
              const checkResults3 = await chrome.scripting.executeScript({
                target: { tabId: linkedinTab.id },
                func: () => {
                  const recItems = document.querySelectorAll('li.pvs-list__paged-list-item');
                  return recItems.length;
                }
              });

              const recCount = checkResults3?.[0]?.result || 0;
              console.log(`Attempt ${attempts3}: Found ${recCount} recommendation items`);

              if (recCount > 0) {
                recsLoaded = true;
                console.log('Recommendations loaded successfully!');
              }
            }

            if (!recsLoaded) {
              console.log('Recommendations did not load after 10 seconds, trying to scrape anyway...');
            }

            // Scrape recommendations from the now-loaded detail page
            const detailRecsResults = await chrome.scripting.executeScript({
              target: { tabId: linkedinTab.id },
              func: scrapeRecommendationsFromCurrentPage
            });

            const detailRecsData = detailRecsResults?.[0]?.result;
            console.log('Detail recommendations result:', detailRecsData);

            if (detailRecsData?.success && detailRecsData.references?.length > 0) {
              console.log(`Found ${detailRecsData.references.length} recommendations from detail page`);

              // Merge scraped recommendations with existing ones (avoid duplicates)
              const existingRecNames = new Set(profileData.references.map((r: any) => r.name));
              const newRecs = detailRecsData.references.filter((r: any) => !existingRecNames.has(r.name));

              // Add new recommendations to profile
              profileData.references.push(...newRecs);

              console.log(`Added ${newRecs.length} new recommendations from detail page. Total: ${profileData.references.length}`);
            } else {
              console.log('Could not scrape recommendations from detail page:', detailRecsData?.error || 'No result returned');
            }

            // Navigate back to the original profile page
            if (currentUrl3) {
              console.log(`Navigating back to: ${currentUrl3}`);
              await chrome.tabs.update(linkedinTab.id, { url: currentUrl3 });
            }
          } catch (err) {
            console.error('Exception while navigating to recommendations detail page:', err);
          }
        } else {
          console.log(`Already have ${profileData.references.length} recommendations from main scraping, skipping detail page`);
        }

        // Create a new profile from the LinkedIn data
        const profileName = profileData.basics?.name || `LinkedIn Import ${new Date().toLocaleDateString()}`;
        const id = nanoid();
        const now = new Date().toISOString();

        await upsertProfile({
          id,
          name: profileName,
          resume: profileData,
          updatedAt: now
        });

        // Hide the overlay on success
        await chrome.scripting.executeScript({
          target: { tabId: linkedinTab.id },
          func: hideLinkedInImportOverlay
        });

        return { ok: true, data: { id, name: profileName } };

      } catch (error) {
        console.error('LinkedIn import failed:', error);

        // Try to hide overlay on error (linkedinTab might be undefined in some error cases)
        try {
          if (linkedinTab?.id) {
            await chrome.scripting.executeScript({
              target: { tabId: linkedinTab.id },
              func: hideLinkedInImportOverlay
            });
          }
        } catch (overlayError) {
          console.error('Could not hide overlay:', overlayError);
        }

        return { ok: false, error: error instanceof Error ? error.message : "LinkedIn import failed" };
      }
    }
    case "JD_CREATE_COLLECTION": {
      const id = await createCollection(message.name);
      return { ok: true, data: id };
    }
    case "JD_LIST_COLLECTIONS": {
      const collections = await listCollections();
      return { ok: true, data: collections };
    }
    case "JD_RENAME_COLLECTION": {
      await renameCollection(message.id, message.name);
      return { ok: true };
    }
    case "JD_DELETE_COLLECTION": {
      await deleteCollection(message.id);
      return { ok: true };
    }
    case "JD_ADD_ITEM": {
      const payload: JDAddItemPayload = message.payload;
      const { collectionId, ...rest } = payload;
      const id = await addJDItem(collectionId, rest);
      return { ok: true, data: id };
    }
    case "JD_LIST_ITEMS": {
      const items = await listJDItems(message.collectionId);
      return { ok: true, data: items };
    }
    case "JD_GET_ITEM": {
      const item = await getJDItem(message.id);
      return { ok: true, data: item };
    }
    case "JD_LIST_BY_HOST": {
      const groups = await listJobDescriptionsByHost(message.host);
      return { ok: true, data: groups };
    }
    case "JD_REMOVE_ITEM": {
      await removeJDItem(message.id);
      return { ok: true };
    }
    case "JD_UPSERT_EMBEDDING": {
      await upsertItemEmbedding(message.id, message.emb);
      return { ok: true };
    }
    case "JD_UPDATE_ITEM_TAGS": {
      await updateJDItemTags(message.id, message.tags);
      return { ok: true };
    }
    case "JD_SET_ITEM_SKILLS": {
      await updateJDItemSkills(message.id, message.skills);
      return { ok: true };
    }
    case "JD_SET_ITEM_GAP": {
      await updateJDItemGap(message.id, {
        profileId: message.profileId,
        matched: message.matched,
        missing: message.missing
      });
      return { ok: true };
    }
    case "JD_SET_KEYWORDS": {
      await updateCollectionKeywords(message.collectionId, message.keywords);
      return { ok: true };
    }
    case "PROFILE_SET_COMPUTED_SKILLS": {
      await setProfileComputedSkills(message.id, message.skills, message.computedAt);
      return { ok: true };
    }
    case "HISTORY_LOG_AUTOFILL": {
      const payload: HistoryLogPayload = message.payload;
      const host = payload.host || (payload.url ? new URL(payload.url).host : "");
      if (!host) {
        return { ok: false, error: "MISSING_HOST" };
      }
      const canonicalUrl = payload.canonicalUrl || (payload.url ? canonicalizeJobUrl(payload.url) : undefined);
      const signature = payload.signature || buildJobSignature(payload.title, payload.company);
      const enriched: HistoryLogPayload = {
        ...payload,
        host,
        canonicalUrl,
        signature
      };

      const match = await findJobDescriptionMatch(enriched);
      if (match && !enriched.jdItemId) {
        enriched.jdItemId = match.item.id;
        enriched.collectionId = match.item.collectionId;
        enriched.matchTier = match.tier;
        enriched.matchScore = match.score;
      }

      const id = await addHistory(enriched);

      const response: Record<string, unknown> = { id };
      if (match) {
        const collection = await db.jd_collections.get(match.item.collectionId);
        response.match = {
          itemId: match.item.id,
          collectionId: match.item.collectionId,
          collectionName: collection?.name ?? "",
          title: match.item.title ?? "Untitled",
          company: match.item.company ?? undefined,
          tier: match.tier,
          score: match.score
        };
      }

      return { ok: true, data: response };
    }
    case "HISTORY_LINK_JD": {
      const { historyId, jdItemId } = message;
      if (!historyId) {
        return { ok: false, error: "MISSING_HISTORY_ID" };
      }
      if (jdItemId) {
        const item = await db.jd_items.get(jdItemId);
        if (!item) {
          return { ok: false, error: "JD_NOT_FOUND" };
        }
        await linkHistoryToJobDescription(historyId, jdItemId, {
          tier: "manual",
          score: 1,
          collectionId: item.collectionId
        });
        return {
          ok: true,
          data: {
            jdItemId,
            collectionId: item.collectionId,
            title: item.title ?? "Untitled",
            company: item.company ?? undefined
          }
        };
      }
      await linkHistoryToJobDescription(historyId, null, { tier: "manual-clear", score: 0 });
      return { ok: true, data: null };
    }
    case "HISTORY_LIST": {
      const params: HistoryListParams | undefined = message.params;
      const events = await listHistory(params);
      return { ok: true, data: events };
    }
    case "HISTORY_SET_STATUS": {
      await setHistoryStatus(message.id, message.status);
      return { ok: true };
    }
    case "HISTORY_SET_NOTE": {
      await setHistoryNote(message.id, message.note);
      return { ok: true };
    }
    case "HISTORY_REMOVE": {
      await removeHistory(message.id);
      return { ok: true };
    }
    case "HISTORY_CLEAR": {
      await clearHistory();
      return { ok: true };
    }
    case "ALERT_GET_SETTINGS": {
      const settings = await readAlertSettings();
      return { ok: true, data: settings };
    }
    case "ALERT_UPDATE_SETTINGS": {
      await writeAlertSettings(message.settings);
      return { ok: true };
    }
    case "ALERT_CHECK_NOW": {
      // Manually trigger reminder check for testing
      const notifications = await checkAndNotify();
      return { ok: true, data: { checked: true, notificationCount: notifications } };
    }
    default:
      return { ok: false, error: "UNKNOWN_MESSAGE" };
  }
}

interface JobMatchResult {
  item: JDItem;
  tier: string;
  score: number;
}

/**
 * Show a loading overlay on the LinkedIn page during import
 * This function is injected into the LinkedIn page to display import progress
 */
function showLinkedInImportOverlay(message: string) {
  // Check if overlay already exists
  if (document.getElementById('jobsnap-import-overlay')) {
    return;
  }

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'jobsnap-import-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  // Create modal card
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 32px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    min-width: 320px;
    max-width: 480px;
    text-align: center;
  `;

  // Create spinner
  const spinner = document.createElement('div');
  spinner.id = 'jobsnap-import-spinner';
  spinner.style.cssText = `
    border: 4px solid #f3f3f3;
    border-top: 4px solid #0a66c2;
    border-radius: 50%;
    width: 48px;
    height: 48px;
    animation: spin 1s linear infinite;
    margin: 0 auto 24px;
  `;

  // Add keyframes animation for spinner
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Create message text
  const messageEl = document.createElement('div');
  messageEl.id = 'jobsnap-import-message';
  messageEl.style.cssText = `
    font-size: 18px;
    font-weight: 600;
    color: #333;
    margin-bottom: 8px;
  `;
  messageEl.textContent = message;

  // Create subtitle
  const subtitle = document.createElement('div');
  subtitle.style.cssText = `
    font-size: 14px;
    color: #666;
  `;
  subtitle.textContent = 'Please wait while we collect your profile data...';

  // Assemble modal
  modal.appendChild(spinner);
  modal.appendChild(messageEl);
  modal.appendChild(subtitle);
  overlay.appendChild(modal);

  // Add to page
  document.body.appendChild(overlay);
}

/**
 * Update the message displayed in the LinkedIn import overlay
 */
function updateLinkedInImportOverlay(message: string) {
  const messageEl = document.getElementById('jobsnap-import-message');
  if (messageEl) {
    messageEl.textContent = message;
  }
}

/**
 * Hide and remove the LinkedIn import overlay
 */
function hideLinkedInImportOverlay() {
  const overlay = document.getElementById('jobsnap-import-overlay');
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Fetch LinkedIn profile data using Voyager API from page context
 * This function is injected into the LinkedIn page to use cookies
 */
async function fetchLinkedInVoyagerProfileInPage(profileId: string) {
  try {
    const voyagerBase = 'https://www.linkedin.com/voyager/api';
    const endpoint = `${voyagerBase}/identity/profiles/${profileId}/profileView`;

    const response = await fetch(endpoint, {
      credentials: 'include',
      headers: {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'x-restli-protocol-version': '2.0.0',
        'csrf-token': getCsrfToken()
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `LinkedIn API returned ${response.status}`
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch profile'
    };
  }

  function getCsrfToken(): string {
    // LinkedIn stores CSRF token in cookies as 'JSESSIONID'
    const match = document.cookie.match(/JSESSIONID="([^"]+)"/);
    return match ? match[1] : '';
  }
}

/**
 * Fetch full LinkedIn skills data using Voyager API from page context
 * This function is injected into the LinkedIn page to use cookies
 */
async function fetchLinkedInSkillsInPage(profileId: string) {
  try {
    const voyagerBase = 'https://www.linkedin.com/voyager/api';
    const endpoint = `${voyagerBase}/identity/profiles/${profileId}/skillCategory`;

    const response = await fetch(endpoint, {
      credentials: 'include',
      headers: {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'x-restli-protocol-version': '2.0.0',
        'csrf-token': getCsrfToken()
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Skills API returned ${response.status}`
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch skills'
    };
  }

  function getCsrfToken(): string {
    // LinkedIn stores CSRF token in cookies as 'JSESSIONID' with format 'ajax:TOKEN'
    const match = document.cookie.match(/JSESSIONID="ajax:(\d+)"/);
    return match ? match[1] : '';
  }
}

/**
 * Scrape skills from the currently loaded LinkedIn page (live DOM)
 * This works on the skills detail page after it's been loaded in the browser
 */
function scrapeSkillsFromCurrentPage() {
  try {
    const skills: Array<{ name: string; endorsementCount?: number }> = [];
    const addedSkillNames = new Set<string>();

    // Find all skill list items on the page
    const skillItems = document.querySelectorAll('li.pvs-list__paged-list-item');

    console.log(`Found ${skillItems.length} skill items on current page`);

    skillItems.forEach((item: Element) => {
      // Strategy 1: Look for the anchor link with data-field="skill_page_skill_topic"
      const skillLink = item.querySelector('a[data-field="skill_page_skill_topic"]');
      if (skillLink) {
        const skillSpan = skillLink.querySelector('span[aria-hidden="true"]');
        if (skillSpan) {
          const skillName = skillSpan.textContent?.trim() || "";

          if (skillName &&
              skillName.length > 1 &&
              skillName.length < 100 &&
              !skillName.match(/endorsed|endorsement|^\d+$|^$|·|connections?| at |passed.*assessment|issued|expires|^[A-Z][a-z]{2,4}fd$|through|one through/i) &&
              !addedSkillNames.has(skillName)) {

            // Look for endorsement count
            let endorsementCount: number | undefined;
            const allSpans = Array.from(item.querySelectorAll('span[aria-hidden="true"]'));
            const endorsementText = allSpans.find(s =>
              s.textContent?.match(/^\d+\s+endorsement/i)
            )?.textContent;

            if (endorsementText) {
              const match = endorsementText.match(/^(\d+)/);
              if (match) {
                endorsementCount = parseInt(match[1], 10);
              }
            }

            skills.push({ name: skillName, endorsementCount });
            addedSkillNames.add(skillName);
            return;
          }
        }
      }

      // Strategy 2: Fallback - look for bold text
      const boldText = item.querySelector('.t-bold > span[aria-hidden="true"]');
      if (boldText) {
        const skillName = boldText.textContent?.trim() || "";
        if (skillName &&
            skillName.length > 1 &&
            skillName.length < 100 &&
            !skillName.match(/endorsed|endorsement|^\d+$|^$|·|connections?| at |passed.*assessment|issued|expires|^[A-Z][a-z]{2,4}fd$|through|one through/i) &&
            !addedSkillNames.has(skillName)) {
          skills.push({ name: skillName });
          addedSkillNames.add(skillName);
          return;
        }
      }

      // Strategy 3: Last resort - iterate through all spans
      const spans = Array.from(item.querySelectorAll('span[aria-hidden="true"]'));
      for (const span of spans) {
        const text = span.textContent?.trim() || "";

        if (text &&
            text.length > 1 &&
            text.length < 100 &&
            !text.match(/endorsed|endorsement|^\d+$|^$|·|connections?| at |experiences? across|passed.*assessment|issued|expires|^[A-Z][a-z]{2,4}fd$|through|one through/i) &&
            !addedSkillNames.has(text)) {
          skills.push({ name: text });
          addedSkillNames.add(text);
          break;
        }
      }
    });

    console.log(`Successfully scraped ${skills.length} skills from current page`);

    return {
      success: true,
      skills,
      count: skills.length
    };

  } catch (error) {
    console.error('Error scraping skills from current page:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Scrape certificates from the currently loaded LinkedIn page (live DOM)
 * This works on the certificates detail page after it's been loaded in the browser
 */
function scrapeCertificatesFromCurrentPage() {
  try {
    const certificates: Array<{ name: string; issuer?: string; date?: string }> = [];
    const addedCertNames = new Set<string>();

    // Find all certificate list items on the page
    const certItems = document.querySelectorAll('li.pvs-list__paged-list-item');

    console.log(`Found ${certItems.length} certificate items on current page`);

    certItems.forEach((item: Element) => {
      const spans = Array.from(item.querySelectorAll('span[aria-hidden="true"]'));
      const allText = spans.map(s => s.textContent?.trim()).filter(Boolean);

      // Parse structure: [Name, Issuer, Date]
      // The first span usually contains the certificate name
      // The second span contains the issuer
      // The third span contains the date
      if (allText.length > 0) {
        const certName = allText[0] || "";

        // Validate certificate name
        if (certName &&
            certName.length > 2 &&
            certName.length < 200 &&
            !certName.match(/^Issued |^Expires |^\d+$|^$|·/i) &&
            !addedCertNames.has(certName)) {

          const certIssuer = allText[1] || "";
          let certDate = "";

          // Look for date in the remaining text
          // Date might be in format "Issued Month Year" or just "Month Year"
          for (let i = 2; i < allText.length; i++) {
            const text = allText[i];
            if (text.match(/\d{4}|issued|expires/i)) {
              certDate = text;
              break;
            }
          }

          certificates.push({
            name: certName,
            issuer: certIssuer.length > 0 && certIssuer.length < 200 ? certIssuer : undefined,
            date: certDate.length > 0 ? certDate : undefined
          });
          addedCertNames.add(certName);
        }
      }
    });

    console.log(`Successfully scraped ${certificates.length} certificates from current page`);

    return {
      success: true,
      certificates,
      count: certificates.length
    };

  } catch (error) {
    console.error('Error scraping certificates from current page:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Scrape recommendations/references from the currently loaded LinkedIn page (live DOM)
 * This works on the recommendations detail page after it's been loaded in the browser
 * Only scrapes from the "Received" tab
 */
function scrapeRecommendationsFromCurrentPage() {
  try {
    const references: Array<{ name: string; reference: string }> = [];
    const addedRefNames = new Set<string>();

    // Find the "Received" tab panel (it should be the active one)
    const receivedTab = document.querySelector('div.artdeco-tabpanel.active[role="tabpanel"]');

    if (!receivedTab) {
      console.log('Could not find active Received tab');
      return {
        success: false,
        error: 'Could not find active Received tab'
      };
    }

    // Find all recommendation list items within the Received tab
    const recItems = receivedTab.querySelectorAll('li.pvs-list__paged-list-item');

    console.log(`Found ${recItems.length} recommendation items in Received tab`);

    recItems.forEach((item: Element) => {
      // Find the recommender's name - it's in the bold text link
      const nameElement = item.querySelector('div.hoverable-link-text.t-bold span[aria-hidden="true"]');
      const refName = nameElement?.textContent?.trim() || "";

      // Find the recommendation text - it's in a nested list item with specific structure
      // Look for the nested ul > li with the actual recommendation text
      const recTextElement = item.querySelector('li.pvs-list__item--with-top-padding div.t-14.t-normal.t-black span[aria-hidden="true"]');
      const refText = recTextElement?.textContent?.trim() || "";

      // Validate and add the recommendation
      if (refName &&
          refName.length > 2 &&
          refName.length < 100 &&
          !refName.match(/^\d+$|^$|·|All LinkedIn members/i) &&
          !addedRefNames.has(refName) &&
          refText &&
          refText.length > 20) {

        references.push({
          name: refName,
          reference: refText
        });
        addedRefNames.add(refName);
      }
    });

    console.log(`Successfully scraped ${references.length} recommendations from Received tab`);

    return {
      success: true,
      references,
      count: references.length
    };

  } catch (error) {
    console.error('Error scraping recommendations from current page:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Fetch and scrape all skills from the LinkedIn skills detail page
 * This fetches the /details/skills/ page HTML and parses all skills from it
 */
async function fetchLinkedInSkillsFromDetailPage(profileId: string) {
  console.log(`[SKILLS FETCH] Starting for profile: ${profileId}`);

  try {
    // Fetch the skills detail page HTML
    const skillsPageUrl = `https://www.linkedin.com/in/${profileId}/details/skills/`;
    console.log(`[SKILLS FETCH] URL: ${skillsPageUrl}`);

    let response;
    try {
      response = await fetch(skillsPageUrl, {
        credentials: 'include',
        headers: {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'same-origin'
        }
      });
      console.log(`[SKILLS FETCH] Response status: ${response.status} ${response.statusText}`);
    } catch (fetchError) {
      console.error('[SKILLS FETCH] Fetch failed:', fetchError);
      return {
        success: false,
        error: `Fetch failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
      };
    }

    if (!response.ok) {
      console.log(`[SKILLS FETCH] Response not OK: ${response.status}`);
      return {
        success: false,
        error: `Skills detail page returned ${response.status}: ${response.statusText}`
      };
    }

    let html;
    try {
      html = await response.text();
      console.log(`[SKILLS FETCH] HTML length: ${html.length} characters`);
    } catch (textError) {
      console.error('[SKILLS FETCH] Failed to read response text:', textError);
      return {
        success: false,
        error: `Failed to read response: ${textError instanceof Error ? textError.message : String(textError)}`
      };
    }
    console.log(`Fetched HTML length: ${html.length} characters`);

    // Parse the HTML to extract skills
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const skills: Array<{ name: string; endorsementCount?: number }> = [];
    const addedSkillNames = new Set<string>();

    // Diagnostic: Check what we got
    const bodyText = doc.body?.textContent?.substring(0, 500) || '';
    const hasActualContent = bodyText.length > 100 && !bodyText.includes('Experience an issue?');

    // Select all skill items from the parsed HTML
    // The skills detail page uses li.pvs-list__paged-list-item structure
    const skillItems = doc.querySelectorAll(
      'li.pvs-list__paged-list-item'
    );

    // Diagnostic info
    const diagnostics = {
      bodyTextLength: bodyText.length,
      bodyTextPreview: bodyText.substring(0, 200),
      hasActualContent,
      skillItemsFound: skillItems.length,
      totalSpans: doc.querySelectorAll('span').length,
      totalDivs: doc.querySelectorAll('div').length
    };

    // If no skill items found, the page might be showing a login wall or different structure
    if (skillItems.length === 0) {
      // Try to extract skills from all spans as a fallback
      const allSpans = doc.querySelectorAll('span[aria-hidden="true"]');

      // Return diagnostic info to help debug
      return {
        success: false,
        error: 'No skill items found in HTML',
        diagnostics,
        sampleSpans: Array.from(allSpans).slice(0, 20).map(s => s.textContent?.trim()).filter(Boolean)
      };
    }

    skillItems.forEach((item: Element) => {
      // Based on user's selector path, the skill name is deeply nested:
      // li > div > div > div.display-flex.flex-column > div.display-flex.flex-row > a > div > div > div > div > span:nth-child(1)

      // Strategy 1: Look for the anchor link that contains the skill name
      // The skill is in an <a> tag with data-field="skill_page_skill_topic"
      const skillLink = item.querySelector('a[data-field="skill_page_skill_topic"]');
      if (skillLink) {
        // Within the link, find the first span with aria-hidden="true"
        const skillSpan = skillLink.querySelector('span[aria-hidden="true"]');
        if (skillSpan) {
          const skillName = skillSpan.textContent?.trim() || "";

          if (skillName &&
              skillName.length > 1 &&
              skillName.length < 100 &&
              !skillName.match(/endorsed|endorsement|^\d+$|^$|·|connections?| at |passed.*assessment|issued|expires|^[A-Z][a-z]{2,4}fd$|through|one through/i) &&
              !addedSkillNames.has(skillName)) {

            // Look for endorsement count in the item
            const endorsementSpan = item.querySelector('span[aria-hidden="true"]');
            let endorsementCount: number | undefined;
            const allSpans = Array.from(item.querySelectorAll('span[aria-hidden="true"]'));
            const endorsementText = allSpans.find(s =>
              s.textContent?.match(/^\d+\s+endorsement/i)
            )?.textContent;

            if (endorsementText) {
              const match = endorsementText.match(/^(\d+)/);
              if (match) {
                endorsementCount = parseInt(match[1], 10);
              }
            }

            skills.push({ name: skillName, endorsementCount });
            addedSkillNames.add(skillName);
            return;
          }
        }
      }

      // Strategy 2: Fallback - look for bold text (t-bold class)
      const boldText = item.querySelector('.t-bold > span[aria-hidden="true"]');
      if (boldText) {
        const skillName = boldText.textContent?.trim() || "";
        if (skillName &&
            skillName.length > 1 &&
            skillName.length < 100 &&
            !skillName.match(/endorsed|endorsement|^\d+$|^$|·|connections?| at |passed.*assessment|issued|expires|^[A-Z][a-z]{2,4}fd$|through|one through/i) &&
            !addedSkillNames.has(skillName)) {
          skills.push({ name: skillName });
          addedSkillNames.add(skillName);
          return;
        }
      }

      // Strategy 3: Last resort - iterate through all spans
      const spans = Array.from(item.querySelectorAll('span[aria-hidden="true"]'));
      for (const span of spans) {
        const text = span.textContent?.trim() || "";

        if (text &&
            text.length > 1 &&
            text.length < 100 &&
            !text.match(/endorsed|endorsement|^\d+$|^$|·|connections?| at |experiences? across|passed.*assessment|issued|expires|^[A-Z][a-z]{2,4}fd$|through|one through/i) &&
            !addedSkillNames.has(text)) {
          skills.push({ name: text });
          addedSkillNames.add(text);
          break;
        }
      }
    });

    console.log(`Successfully scraped ${skills.length} skills from detail page HTML`);

    return {
      success: true,
      skills,
      count: skills.length
    };

  } catch (error) {
    console.error('Error in fetchLinkedInSkillsFromDetailPage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function parseLinkedInVoyagerResponse(voyagerData: any, skillsData?: any): any {
  const profile: any = {
    basics: { profiles: [] },
    work: [],
    education: [],
    skills: [],
    projects: [],
    awards: [],
    publications: [],
    volunteer: [],
    interests: [],
    references: [],
    languages: [],
    certificates: []
  };

  const entities: Record<string, any> = {};
  if (voyagerData.included && Array.isArray(voyagerData.included)) {
    voyagerData.included.forEach((entity: any) => {
      if (entity.entityUrn) {
        entities[entity.entityUrn] = entity;
      }
    });
  }

  // Find the main profile entity
  const profileEntity = voyagerData.included?.find((e: any) =>
    e.$type === 'com.linkedin.voyager.identity.profile.Profile'
  );

  if (profileEntity) {
    const localeObj = profileEntity.defaultLocale || profileEntity.primaryLocale || {};

    // Debug: log what location data we have
    console.log('Profile entity location data:', {
      locationName: profileEntity.locationName,
      geoLocation: profileEntity.geoLocation,
      geoLocationName: profileEntity.geoLocationName,
      hasGeoUrn: !!profileEntity.geoUrn
    });

    // Parse location - geoLocationName has "City, State" format
    let location: any = undefined;
    if (profileEntity.geoLocationName) {
      // Parse "City, State" format
      const parts = profileEntity.geoLocationName.split(',').map((p: string) => p.trim());
      location = {
        city: parts[0] || undefined,
        region: parts[1] || undefined,
        countryCode: profileEntity.locationName === 'United States' ? 'US' : undefined,
        postalCode: profileEntity.geoLocation?.postalCode || undefined
      };
    } else if (profileEntity.locationName) {
      // Fallback to locationName
      location = {
        city: profileEntity.locationName,
        postalCode: profileEntity.geoLocation?.postalCode || undefined
      };
    }

    // Only create LinkedIn URL if we have a valid publicIdentifier (not "me" or other generic values)
    const isValidPublicIdentifier = profileEntity.publicIdentifier &&
                                    profileEntity.publicIdentifier !== 'me'; // Exclude internal IDs
    const linkedInUrl = isValidPublicIdentifier ?
      `https://linkedin.com/in/${profileEntity.publicIdentifier}` : undefined;

    profile.basics = {
      name: `${profileEntity.firstName || ''} ${profileEntity.lastName || ''}`.trim(),
      label: profileEntity.headline || '',
      summary: profileEntity.summary || '',
      location: location,
      url: undefined, // Will be set from websites below
      email: undefined, // Not available in Voyager API
      phone: undefined, // Not available in Voyager API
      profiles: []
    };

    // Add LinkedIn profile (only if we have a valid, personalized URL)
    if (linkedInUrl) {
      const linkedInProfile = {
        network: 'LinkedIn',
        username: profileEntity.publicIdentifier,
        url: linkedInUrl
      };
      profile.basics.profiles.push(linkedInProfile);
      console.log('Added LinkedIn profile:', linkedInProfile);
    } else {
      console.log('No LinkedIn URL - publicIdentifier:', profileEntity.publicIdentifier, '(excluded generic or invalid ID)');
    }

    // Extract websites
    console.log('Profile websites:', profileEntity.websites);
    if (profileEntity.websites && Array.isArray(profileEntity.websites)) {
      profileEntity.websites.forEach((site: any) => {
        if (site.url) {
          const websiteProfile = {
            network: site.type?.category || 'Website',
            url: site.url
          };
          profile.basics.profiles.push(websiteProfile);
          console.log('Added website profile:', websiteProfile);

          // Set first website as primary URL
          if (!profile.basics.url) {
            profile.basics.url = site.url;
          }
        }
      });
    }

    console.log('Final profiles array:', profile.basics.profiles);

    if (localeObj.language) {
      profile.languages.push({
        language: localeObj.language.toLowerCase() === 'en' ? 'English' : localeObj.language,
        fluency: 'Native Speaker'
      });
    }
  }

  // Extract work experience - ALL positions
  const positions = voyagerData.included?.filter((e: any) =>
    e.$type === 'com.linkedin.voyager.identity.profile.Position'
  ) || [];

  positions.forEach((position: any) => {
    const workItem: any = {
      name: position.companyName || '',
      position: position.title || '',
      summary: position.description || '',
      location: position.locationName || ''
    };

    const timePeriod = position.timePeriod || position.dateRange;
    if (timePeriod) {
      if (timePeriod.startDate) {
        const { year, month } = timePeriod.startDate;
        workItem.startDate = year ? `${year}-${(month || 1).toString().padStart(2, '0')}-01` : '';
      }
      if (timePeriod.endDate) {
        const { year, month } = timePeriod.endDate;
        workItem.endDate = year ? `${year}-${(month || 12).toString().padStart(2, '0')}-01` : '';
      }
    }

    profile.work.push(workItem);
  });

  // Extract education - ALL entries
  const education = voyagerData.included?.filter((e: any) =>
    e.$type === 'com.linkedin.voyager.identity.profile.Education'
  ) || [];

  education.forEach((edu: any) => {
    const eduItem: any = {
      institution: edu.schoolName || '',
      studyType: edu.degreeName || '',
      area: edu.fieldOfStudy || '',
      score: edu.grade || ''
    };

    const timePeriod = edu.timePeriod || edu.dateRange;
    if (timePeriod) {
      if (timePeriod.startDate) {
        const { year, month } = timePeriod.startDate;
        eduItem.startDate = year ? `${year}-${(month || 1).toString().padStart(2, '0')}-01` : '';
      }
      if (timePeriod.endDate) {
        const { year, month } = timePeriod.endDate;
        eduItem.endDate = year ? `${year}-${(month || 12).toString().padStart(2, '0')}-01` : '';
      }
    }

    profile.education.push(eduItem);
  });

  // Extract skills - ALL skills from separate API call if available, otherwise from profileView
  const addedSkills = new Set<string>();

  // First, try to use skills from the separate skillCategory API call
  if (skillsData && skillsData.included && Array.isArray(skillsData.included)) {
    console.log('Using skills from skillCategory API, total entities:', skillsData.included.length);

    // Filter for skill-specific entities only
    const skillEntities = skillsData.included.filter((e: any) =>
      e.$type === 'com.linkedin.voyager.identity.profile.Skill' ||
      e.$type === 'com.linkedin.voyager.dash.identity.profile.Skill' ||
      e.name  // Also include entities that have a name property (likely skills)
    );

    console.log('Filtered skill entities:', skillEntities.length);

    skillEntities.forEach((skillObj: any, index: number) => {
      const skillName = skillObj.name || skillObj.skill?.name;
      if (index < 5) {
        console.log(`Skill ${index} from skillCategory API:`, {
          type: skillObj.$type,
          name: skillName,
          endorsementCount: skillObj.endorsementCount,
          raw: skillObj
        });
      }

      if (skillName && !addedSkills.has(skillName)) {
        addedSkills.add(skillName);
        profile.skills.push({
          name: skillName,
          level: skillObj.endorsementCount ? `${skillObj.endorsementCount} endorsements` : undefined
        });
      }
    });
  } else {
    // Fallback to skills from main profileView API
    console.log('No skillsData available, falling back to profileView skills');
    const skills = voyagerData.included?.filter((e: any) =>
      e.$type === 'com.linkedin.voyager.identity.profile.Skill' ||
      e.$type === 'com.linkedin.voyager.identity.profile.SkillView'
    ) || [];

    console.log('Found skills entities in profileView:', skills.length, 'Sample:', skills[0]);

    skills.forEach((skill: any, index: number) => {
      const skillName = skill.name || skill.skill?.name;
      if (index < 5) {
        console.log(`Skill ${index}:`, { name: skillName, endorsementCount: skill.endorsementCount, raw: skill });
      }
      if (skillName && !addedSkills.has(skillName)) {
        addedSkills.add(skillName);
        profile.skills.push({
          name: skillName,
          level: skill.endorsementCount ? `${skill.endorsementCount} endorsements` : undefined
        });
      }
    });
  }

  console.log('Total skills added to profile:', profile.skills.length);

  // Extract projects
  const projects = voyagerData.included?.filter((e: any) =>
    e.$type === 'com.linkedin.voyager.identity.profile.Project'
  ) || [];

  projects.forEach((project: any) => {
    const projectItem: any = {
      name: project.title || '',
      description: project.description || '',
      url: project.url || ''
    };

    const timePeriod = project.timePeriod || project.dateRange;
    if (timePeriod) {
      if (timePeriod.startDate) {
        const { year, month } = timePeriod.startDate;
        projectItem.startDate = year ? `${year}-${(month || 1).toString().padStart(2, '0')}-01` : '';
      }
      if (timePeriod.endDate) {
        const { year, month } = timePeriod.endDate;
        projectItem.endDate = year ? `${year}-${(month || 12).toString().padStart(2, '0')}-01` : '';
      }
    }

    profile.projects.push(projectItem);
  });

  // Extract certifications
  const certifications = voyagerData.included?.filter((e: any) =>
    e.$type === 'com.linkedin.voyager.identity.profile.Certification'
  ) || [];

  certifications.forEach((cert: any) => {
    const certItem: any = {
      name: cert.name || '',
      issuer: cert.authority || cert.company || ''
    };

    if (cert.timePeriod?.startDate || cert.displayDate) {
      const startDate = cert.timePeriod?.startDate || cert.displayDate;
      if (startDate.year) {
        certItem.date = `${startDate.year}-${(startDate.month || 1).toString().padStart(2, '0')}-01`;
      }
    }

    if (cert.url) {
      certItem.url = cert.url;
    }

    profile.certificates.push(certItem);
  });

  // Extract volunteer experience
  const volunteer = voyagerData.included?.filter((e: any) =>
    e.$type === 'com.linkedin.voyager.identity.profile.VolunteerExperience'
  ) || [];

  volunteer.forEach((vol: any) => {
    const volItem: any = {
      organization: vol.companyName || '',
      position: vol.role || '',
      summary: vol.description || ''
    };

    const timePeriod = vol.timePeriod || vol.dateRange;
    if (timePeriod) {
      if (timePeriod.startDate) {
        const { year, month } = timePeriod.startDate;
        volItem.startDate = year ? `${year}-${(month || 1).toString().padStart(2, '0')}-01` : '';
      }
      if (timePeriod.endDate) {
        const { year, month } = timePeriod.endDate;
        volItem.endDate = year ? `${year}-${(month || 12).toString().padStart(2, '0')}-01` : '';
      }
    }

    profile.volunteer.push(volItem);
  });

  // Extract languages (in addition to default language)
  const languages = voyagerData.included?.filter((e: any) =>
    e.$type === 'com.linkedin.voyager.identity.profile.Language'
  ) || [];

  const addedLanguages = new Set(profile.languages.map((l: any) => l.language));
  languages.forEach((lang: any) => {
    if (lang.name && !addedLanguages.has(lang.name)) {
      const proficiencyMap: Record<string, string> = {
        'NATIVE_OR_BILINGUAL': 'Native Speaker',
        'FULL_PROFESSIONAL': 'Full Professional',
        'PROFESSIONAL_WORKING': 'Professional Working',
        'LIMITED_WORKING': 'Limited Working',
        'ELEMENTARY': 'Elementary'
      };

      profile.languages.push({
        language: lang.name,
        fluency: proficiencyMap[lang.proficiency] || lang.proficiency || ''
      });
      addedLanguages.add(lang.name);
    }
  });

  return profile;
}

async function listJobDescriptionsByHost(host: string) {
  const items = await db.jd_items.where("source.host").equals(host).toArray();
  const collectionNames = new Map<string, string>();
  const groups = new Map<
    string,
    {
      collectionId: string;
      collectionName: string;
      items: Array<{
        id: string;
        title?: string;
        company?: string;
        capturedAt: number;
        tags?: string[];
        url?: string;
      }>;
    }
  >();

  for (const item of items) {
    if (!collectionNames.has(item.collectionId)) {
      const collection = await db.jd_collections.get(item.collectionId);
      collectionNames.set(item.collectionId, collection?.name ?? "Unnamed");
    }
    const key = item.collectionId;
    if (!groups.has(key)) {
      groups.set(key, {
        collectionId: item.collectionId,
        collectionName: collectionNames.get(item.collectionId) ?? "Unnamed",
        items: []
      });
    }
    const group = groups.get(key)!;
    group.items.push({
      id: item.id,
      title: item.title,
      company: item.company,
      capturedAt: item.source.capturedAt,
      tags: item.tags,
      url: item.source.url
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => b.capturedAt - a.capturedAt)
    }))
    .sort((a, b) => a.collectionName.localeCompare(b.collectionName));
}

async function findJobDescriptionMatch(payload: HistoryLogPayload): Promise<JobMatchResult | null> {
  const host = payload.host;
  if (!host) return null;
  const candidates = await db.jd_items.where("source.host").equals(host).toArray();
  if (!candidates.length) return null;

  const canonicalUrl = payload.canonicalUrl || (payload.url ? canonicalizeJobUrl(payload.url) : undefined);
  if (canonicalUrl) {
    const exact = candidates.find((candidate) => getItemCanonicalUrl(candidate) === canonicalUrl);
    if (exact) {
      return { item: exact, tier: "url-exact", score: 1 };
    }
  }

  if (payload.descHash) {
    const hashMatch = candidates.find((candidate) => getItemDescHash(candidate) === payload.descHash);
    if (hashMatch) {
      return { item: hashMatch, tier: "desc-hash", score: 0.99 };
    }
  }

  const signature = payload.signature || buildJobSignature(payload.title, payload.company);
  if (signature) {
    const signatureMatch = candidates.find((candidate) => getItemSignature(candidate) === signature);
    if (signatureMatch) {
      return { item: signatureMatch, tier: "signature-exact", score: 0.95 };
    }
  }

  const normalizedTitle = normalizeJobTerm(payload.title);
  const normalizedCompany = normalizeJobTerm(payload.company);
  if (normalizedTitle || normalizedCompany) {
    const normalizedMatch = candidates.find((candidate) => {
      const candidateTitle = candidate.normalizedTitle || normalizeJobTerm(candidate.title);
      const candidateCompany = candidate.normalizedCompany || normalizeJobTerm(candidate.company);
      if (normalizedTitle && normalizedCompany) {
        return candidateTitle === normalizedTitle && candidateCompany === normalizedCompany;
      }
      if (normalizedTitle && candidateTitle === normalizedTitle) {
        return true;
      }
      if (normalizedCompany && candidateCompany === normalizedCompany) {
        return true;
      }
      return false;
    });
    if (normalizedMatch) {
      return { item: normalizedMatch, tier: "normalized-exact", score: 0.88 };
    }
  }

  return null;
}

function getItemCanonicalUrl(item: JDItem): string | undefined {
  if (item.canonicalUrl) return item.canonicalUrl;
  if (item.source?.url) {
    return canonicalizeJobUrl(item.source.url);
  }
  return undefined;
}

function getItemSignature(item: JDItem): string | undefined {
  if (item.signature) return item.signature;
  return buildJobSignature(item.title, item.company);
}

function getItemDescHash(item: JDItem): string | undefined {
  if (item.descHash) return item.descHash;
  if (typeof item.text === "string" && item.text.trim().length) {
    return hashJobDescription(item.text.trim().slice(0, 1200));
  }
  return undefined;
}

/**
 * Scrape LinkedIn profile directly from DOM when Voyager API fails
 * This function is injected into the LinkedIn page to extract profile data
 */
function scrapeLinkedInProfileFromDOM() {
  const profile: any = {
    basics: { name: "", label: "", email: "", phone: "", url: "", summary: "", location: {}, profiles: [] },
    work: [],
    education: [],
    skills: [],
    projects: [],
    awards: [],
    publications: [],
    volunteer: [],
    interests: [],
    references: [],
    languages: [],
    certificates: []
  };

  // Extract name - try multiple selectors
  let nameEl = document.querySelector('h1.text-heading-xlarge');
  if (!nameEl) nameEl = document.querySelector('h1.inline.t-24.v-align-middle.break-words');
  if (nameEl) profile.basics.name = nameEl.textContent?.trim() || "";

  // Extract headline - try multiple selectors
  let headlineEl = document.querySelector('div.text-body-medium.break-words');
  if (!headlineEl) headlineEl = document.querySelector('.pv-text-details__left-panel .text-body-medium');
  if (headlineEl) profile.basics.label = headlineEl.textContent?.trim() || "";

  // Extract location and parse into components
  const locationEl = document.querySelector('span.text-body-small.inline.t-black--light.break-words');
  if (locationEl) {
    const locationText = locationEl.textContent?.trim() || "";
    profile.basics.location = parseLocation(locationText);
  }

  // Set profile URL (only if not the generic /in/me page)
  const usernameMatch = window.location.pathname.match(/\/in\/([^/?]+)/);
  const username = usernameMatch ? usernameMatch[1] : "";

  // Only set LinkedIn URL if it's a valid personalized profile (not "me" or internal IDs)
  const isValidUsername = username && username !== 'me';

  if (isValidUsername) {
    profile.basics.url = window.location.href;
    profile.basics.profiles = [{
      network: "LinkedIn",
      username: username,
      url: window.location.href
    }];
  } else {
    // Don't save generic LinkedIn URLs
    profile.basics.profiles = [];
  }

  // Extract about/summary - try multiple approaches
  const aboutSection = document.querySelector('#about');
  if (aboutSection) {
    // Try to find the content container
    let aboutContent = aboutSection.parentElement?.querySelector('.inline-show-more-text span[aria-hidden="true"]');
    if (!aboutContent) {
      aboutContent = aboutSection.parentElement?.querySelector('.pv-shared-text-with-see-more span[aria-hidden="true"]');
    }
    if (!aboutContent) {
      // Fallback: get the next div after the about section
      const aboutContainer = aboutSection.closest('section');
      aboutContent = aboutContainer?.querySelector('.display-flex.full-width span[aria-hidden="true"]');
    }
    if (aboutContent) {
      let summaryText = aboutContent.textContent?.trim() || "";
      // Remove "Top Skills:" section if it exists (should be in skills section instead)
      summaryText = summaryText.replace(/Top Skills:.*$/is, '').trim();
      profile.basics.summary = summaryText;
    }
  }

  // Extract work experience with improved parsing
  const experienceSection = document.querySelector('#experience');
  if (experienceSection) {
    const experienceContainer = experienceSection.closest('section');
    // Get only direct children of the main ul to avoid nested list items
    const mainList = experienceContainer?.querySelector('ul');
    const experienceItems = mainList?.querySelectorAll(':scope > li.artdeco-list__item, :scope > li[class*="pvs-list__item"]');

    experienceItems?.forEach((item: Element) => {
      // Skip if this item looks like a nested detail item (contains only bullets/description)
      const isNestedItem = item.querySelector('ul > li');

      // Get all span elements with aria-hidden="true" but exclude nested ones
      const directSpans = Array.from(item.querySelectorAll('span[aria-hidden="true"]'));

      // Get text from spans, excluding very long text that's likely descriptions
      const allText = directSpans
        .map(s => s.textContent?.trim())
        .filter(Boolean)
        .filter(text => text.length < 500); // Exclude description text from main parse

      // Parse structure: typically [Title, Company · Type, Date, Location]
      let position = "";
      let company = "";
      let dates = "";
      let description = "";
      let location = "";

      if (allText.length > 0) {
        position = allText[0] || "";

        // Validate this is actually a position title, not a description
        // Description text is usually very long and starts with bullets
        if (position.length > 200 || position.match(/^●|^•/)) {
          return; // Skip this item, it's not a valid job entry
        }

        // Second element usually contains company name and employment type
        if (allText.length > 1) {
          const companyLine = allText[1];
          // Split on · to separate company from employment type
          const companyParts = companyLine.split('·');
          company = companyParts[0]?.trim() || "";
        }

        // Third element is usually dates - extract just the date range, not duration
        if (allText.length > 2 && allText[2].match(/\d{4}|present|current/i)) {
          // Remove duration info like "· 5 yrs 10 mos" from date string
          dates = allText[2].split('·')[0].trim();
        }

        // Fourth element might be location
        if (allText.length > 3 && !allText[3].match(/\d{4}|present|current|^●|^•/i) && allText[3].length < 100) {
          location = allText[3];
        }

        // Look for description in inline-show-more-text
        const descEl = item.querySelector('.inline-show-more-text span[aria-hidden="true"]');
        if (descEl) description = descEl.textContent?.trim() || "";
      }

      // Only add if we have at least a position or company name
      if ((position && position.length > 2 && position.length < 200) || company) {
        const { start, end } = parseDateRange(dates);
        profile.work.push({
          name: company,
          position: position,
          summary: description,
          location: location,
          startDate: start,
          endDate: end
        });
      }
    });
  }

  // Extract education with improved parsing
  const educationSection = document.querySelector('#education');
  if (educationSection) {
    const educationContainer = educationSection.closest('section');
    // Get only direct children of the main ul to avoid nested list items
    const mainList = educationContainer?.querySelector('ul');
    const eduItems = mainList?.querySelectorAll(':scope > li.artdeco-list__item, :scope > li[class*="pvs-list__item"]');

    eduItems?.forEach((item: Element) => {
      const spans = Array.from(item.querySelectorAll('span[aria-hidden="true"]'));
      // Filter out very long text that's likely descriptions/notes
      const allText = spans
        .map(s => s.textContent?.trim())
        .filter(Boolean)
        .filter(text => text.length < 300);

      // Parse structure: [Institution, Degree + Field, Dates]
      let institution = "";
      let studyType = "";
      let area = "";
      let dates = "";

      if (allText.length > 0) {
        institution = allText[0] || "";

        // Validate institution name isn't actually a description
        if (institution.length > 150 || institution.match(/^Minor in |^Mostly studied/i)) {
          return; // Skip this item, it's not a valid education entry
        }

        if (allText.length > 1) {
          const degreeText = allText[1];
          // Check if this looks like a degree, not a description
          if (!degreeText.match(/^Minor in |^Mostly studied/i) && degreeText.length < 150) {
            const degreeParts = degreeText.split(',');
            studyType = degreeParts[0]?.trim() || "";
            area = degreeParts[1]?.trim() || "";
          }
        }

        if (allText.length > 2 && allText[2].match(/\d{4}/)) {
          dates = allText[2].split('·')[0].trim(); // Remove duration if present
        }
      }

      // Only add if we have a valid institution name
      if (institution && institution.length > 2 && institution.length < 150) {
        const { start, end } = parseDateRange(dates);
        profile.education.push({
          institution,
          studyType,
          area,
          startDate: start,
          endDate: end
        });
      }
    });
  }

  // Extract skills - try to expand all first
  const skillsSection = document.querySelector('#skills');
  if (skillsSection) {
    const skillsContainer = skillsSection.closest('section');

    // Try to click "Show all skills" button if it exists
    const showAllSkillsBtn = skillsContainer?.querySelector('button[aria-label*="Show all"]');
    if (showAllSkillsBtn && showAllSkillsBtn instanceof HTMLElement) {
      showAllSkillsBtn.click();
      // Give it a moment to load
      // Note: This is synchronous, so we can't wait, but it might still help
    }

    // Get all skill items - use a more comprehensive selector
    const skillItems = skillsContainer?.querySelectorAll(
      'ul > li.artdeco-list__item, ' +
      'div[data-view-name="profile-component-entity"], ' +
      'div[class*="pvs-list__paged-list-item"], ' +
      'li[class*="pvs-list__item"], ' +
      'div[class*="profile-section-card"]'
    );

    const addedSkillNames = new Set<string>();

    skillItems?.forEach((item: Element) => {
      // Try multiple strategies to extract the skill name

      // Strategy 1: Look for the first bold/prominent text (usually the skill name)
      const prominentText = item.querySelector('div[class*="display-flex"] > span[aria-hidden="true"]:first-child');
      if (prominentText) {
        const text = prominentText.textContent?.trim() || "";
        // Skills should NOT contain " at " (job titles do), and should be reasonably short
        if (text &&
            text.length > 1 &&
            text.length < 100 &&
            !text.match(/endorsed|endorsement|^\d+$|^$|·|connections?| at /i) &&
            !addedSkillNames.has(text)) {
          profile.skills.push({ name: text });
          addedSkillNames.add(text);
          return; // Skip to next item
        }
      }

      // Strategy 2: Get all text spans and find the first valid one
      const spans = Array.from(item.querySelectorAll('span[aria-hidden="true"]'));

      for (const span of spans) {
        const text = span.textContent?.trim() || "";

        // Filter out non-skill text like "Endorsed by...", numbers, short strings
        // Only filter job titles that have " at " in them (e.g., "Software Engineer at Company")
        if (text &&
            text.length > 1 &&
            text.length < 100 &&
            !text.match(/endorsed|endorsement|^\d+$|^$|·|connections?| at /i) &&
            !addedSkillNames.has(text)) {
          profile.skills.push({ name: text });
          addedSkillNames.add(text);
          break; // Only take the first valid text from each item
        }
      }
    });
  }

  // NOTE: Certificate extraction from DOM scraper is disabled
  // The navigation-based scraping (scrapeCertificatesFromCurrentPage) is more accurate
  // This DOM scraper was too permissive and was incorrectly classifying skills as certificates
  //
  // Extract certifications - try to expand all first
  // const certsSection = document.querySelector('#licenses_and_certifications');
  // if (certsSection) {
  //   const certsContainer = certsSection.closest('section');
  //
  //   // Try to click "Show all certifications" button if it exists
  //   const showAllCertsBtn = certsContainer?.querySelector('button[aria-label*="Show all"]');
  //   if (showAllCertsBtn && showAllCertsBtn instanceof HTMLElement) {
  //     showAllCertsBtn.click();
  //   }
  //
  //   // Get only direct children of the main ul to avoid nested list items
  //   const mainList = certsContainer?.querySelector('ul');
  //   const certItems = mainList?.querySelectorAll(':scope > li.artdeco-list__item, :scope > li[class*="pvs-list__item"]');
  //
  //   const addedCertNames = new Set<string>();
  //
  //   certItems?.forEach((item: Element) => {
  //     const spans = Array.from(item.querySelectorAll('span[aria-hidden="true"]'));
  //     const allText = spans.map(s => s.textContent?.trim()).filter(Boolean);
  //
  //     // Parse structure: [Name, Issuer, Date]
  //     if (allText.length > 0) {
  //       const certName = allText[0] || "";
  //       const certIssuer = allText[1] || "";
  //       const certDate = allText[2] || "";
  //
  //       // Only add if we have a name and haven't added this cert already
  //       if (certName && certName.length > 2 && !addedCertNames.has(certName)) {
  //         profile.certificates.push({
  //           name: certName,
  //           issuer: certIssuer,
  //           date: certDate
  //         });
  //         addedCertNames.add(certName);
  //       }
  //     }
  //   });
  // }

  // Extract languages
  const langSection = document.querySelector('#languages');
  if (langSection) {
    const langContainer = langSection.closest('section');
    const langItems = langContainer?.querySelectorAll(
      'ul > li.artdeco-list__item, ' +
      'li[class*="pvs-list__item"], ' +
      'div[class*="pvs-list__paged-list-item"]'
    );

    langItems?.forEach((item: Element) => {
      const spans = Array.from(item.querySelectorAll('span[aria-hidden="true"]'));
      const allText = spans.map(s => s.textContent?.trim()).filter(Boolean);

      // Parse structure: [Language, Proficiency]
      if (allText.length > 0) {
        profile.languages.push({
          language: allText[0] || "",
          fluency: allText[1] || ""
        });
      }
    });
  }

  // Helper function to parse location string into components
  function parseLocation(locationText: string): any {
    if (!locationText) return {};

    // LinkedIn format is typically: "City, State, Country" or "City, Country"
    const parts = locationText.split(',').map(p => p.trim());

    const location: any = {};

    if (parts.length === 3) {
      // Format: "City, State, Country"
      location.city = parts[0];
      location.region = parts[1]; // State/Province
      location.country = parts[2];
      location.countryCode = getCountryCode(parts[2]);
    } else if (parts.length === 2) {
      // Format: "City, Country"
      location.city = parts[0];
      location.country = parts[1];
      location.countryCode = getCountryCode(parts[1]);
    } else if (parts.length === 1) {
      // Just a city or country
      location.city = parts[0];
    }

    return location;
  }

  // Helper function to convert country name to ISO country code
  function getCountryCode(countryName: string): string {
    const countryMap: Record<string, string> = {
      'united states': 'US',
      'usa': 'US',
      'united states of america': 'US',
      'canada': 'CA',
      'united kingdom': 'GB',
      'uk': 'GB',
      'great britain': 'GB',
      'australia': 'AU',
      'germany': 'DE',
      'france': 'FR',
      'india': 'IN',
      'china': 'CN',
      'japan': 'JP',
      'brazil': 'BR',
      'mexico': 'MX',
      'spain': 'ES',
      'italy': 'IT',
      'netherlands': 'NL',
      'sweden': 'SE',
      'poland': 'PL',
      'belgium': 'BE',
      'switzerland': 'CH',
      'austria': 'AT',
      'norway': 'NO',
      'denmark': 'DK',
      'finland': 'FI',
      'ireland': 'IE',
      'portugal': 'PT',
      'greece': 'GR',
      'czech republic': 'CZ',
      'romania': 'RO',
      'new zealand': 'NZ',
      'singapore': 'SG',
      'south korea': 'KR',
      'israel': 'IL',
      'argentina': 'AR',
      'chile': 'CL',
      'colombia': 'CO',
      'south africa': 'ZA'
    };

    const normalized = countryName.toLowerCase().trim();
    return countryMap[normalized] || '';
  }

  // Helper function to parse date ranges
  function parseDateRange(dateText: string): { start: string; end: string } {
    if (!dateText) return { start: "", end: "" };

    // Handle formats like "Jan 2020 - Present" or "2018 - 2022"
    const parts = dateText.split(/\s*[-–]\s*/);

    let start = "";
    let end = "";

    if (parts.length === 2) {
      start = normalizeDate(parts[0]);
      end = parts[1].match(/present|current/i) ? "" : normalizeDate(parts[1]);
    } else if (parts.length === 1) {
      start = normalizeDate(parts[0]);
      end = normalizeDate(parts[0]);
    }

    return { start, end };
  }

  function normalizeDate(dateStr: string): string {
    if (!dateStr) return "";

    const trimmed = dateStr.trim();

    // If it's just a year
    if (/^\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    // If it's "Month Year" format
    const monthYearMatch = trimmed.match(/^(\w+)\s+(\d{4})$/);
    if (monthYearMatch) {
      const monthMap: Record<string, string> = {
        'jan': '01', 'january': '01',
        'feb': '02', 'february': '02',
        'mar': '03', 'march': '03',
        'apr': '04', 'april': '04',
        'may': '05',
        'jun': '06', 'june': '06',
        'jul': '07', 'july': '07',
        'aug': '08', 'august': '08',
        'sep': '09', 'september': '09',
        'oct': '10', 'october': '10',
        'nov': '11', 'november': '11',
        'dec': '12', 'december': '12'
      };

      const month = monthMap[monthYearMatch[1].toLowerCase()];
      if (month) {
        return `${monthYearMatch[2]}-${month}`;
      }
    }

    return trimmed;
  }

  // Log what we found for debugging
  console.log('LinkedIn DOM scraping results:', {
    name: profile.basics.name,
    headline: profile.basics.label,
    workCount: profile.work.length,
    educationCount: profile.education.length,
    skillsCount: profile.skills.length,
    certsCount: profile.certificates.length,
    languagesCount: profile.languages.length
  });

  return profile;
}

// Set up periodic alarm for checking smart reminders
const REMINDER_ALARM_NAME = "jobsnap-check-reminders";

chrome.runtime.onInstalled.addListener(() => {
  try {
    // Clear any existing context menu entries to avoid duplicates
    chrome.contextMenus.removeAll(() => {
      // Create the single context menu entry
      chrome.contextMenus.create({
        id: "jobsnap-save-selection",
        title: "Save selection to JobSnap…",
        contexts: ["selection"]
      });
    });
  } catch (error) {
    console.warn("JobSnap context menu error", error);
  }

  // Create alarm to check reminders every 4 hours
  chrome.alarms.create(REMINDER_ALARM_NAME, {
    delayInMinutes: 1, // First check after 1 minute
    periodInMinutes: 240, // Then every 4 hours
  });
  console.log("JobSnap: Reminder alarm created");
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "jobsnap-save-selection" || !tab?.id) return;
  if (!info.selectionText || info.selectionText.trim().length < 20) {
    chrome.tabs.sendMessage(tab.id, { type: "JOBSNAP_SHOW_TOAST", message: "Selection too short", error: true });
    return;
  }
  chrome.tabs.sendMessage(tab.id, {
    type: "JOBSNAP_CONTEXT_SAVE",
    text: info.selectionText
  });
});

// Handle alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REMINDER_ALARM_NAME) {
    console.log("JobSnap: Checking reminders...");
    checkAndNotify().catch((error) => {
      console.error("JobSnap: Error checking reminders:", error);
    });
  }
});

// Also check on startup
chrome.runtime.onStartup.addListener(() => {
  console.log("JobSnap: Extension started, checking reminders...");
  checkAndNotify().catch((error) => {
    console.error("JobSnap: Error checking reminders on startup:", error);
  });
});
