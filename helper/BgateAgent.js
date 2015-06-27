'use strict';

var _ = require('lodash');
var moment = require('moment');
var Promise = require('es6-promise').Promise;

var config = require('../config/config');
var Model = require('../config/db').Model;

var mysql      = require('mysql');
var connection = mysql.createConnection(config.db);
connection.connect();

var BGateAgent = {
	agents : [],
	listBanner : [],

	init : function(next) {
		console.info("INFO: ["+ new Date() +"] Init BGate Agent Data.");

		BGateAgent.agents = []; // reset empty

		//var q = "SELECT * FROM (SELECT * FROM auth_Users WHERE DemandCustomerInfoID IS NOT NULL) AS tb1 INNER JOIN (SELECT * FROM `DemandCustomerInfo`) AS tb2 ON tb1.DemandCustomerInfoID = tb2.DemandCustomerInfoID INNER JOIN (SELECT * FROM `AdCampaignBannerPreview`) AS tb3 ON tb1.user_id = tb3.UserID;";
		var q = "SELECT * FROM (SELECT * FROM auth_Users WHERE DemandCustomerInfoID IS NOT NULL) AS tb1 INNER JOIN (SELECT * FROM `DemandCustomerInfo`) AS tb2 ON tb1.DemandCustomerInfoID = tb2.DemandCustomerInfoID INNER JOIN (SELECT * FROM `AdCampaignBannerPreview`) AS tb3 ON tb1.user_id = tb3.UserID INNER JOIN (SELECT AdCampaignPreviewID As AdCampaignID, UserID, `Name` As CampaignName, CampaignMarkup, StartDate as CampaignStartDate, EndDate As CampaignEndDate, ImpressionsCounter as CampaignImpressionsCounter, MaxImpressions as CampaignMaxImpressions, CurrentSpend as CampaignCurrentSpend, MaxSpend as CampaignMaxSpend, CPMTarget as CampaignCPMTarget, CPMTargetValue as CampaignCPMTargetValue, Active as CampaignActive, Deleted as CampaignDeleted, DateCreated as CampaignDateCreated, DateUpdated as CampaignDateUpdated, ChangeWentLive as CampaignChangeWentLive, WentLiveDate as CampaignWentLiveDate, Approval as CampaignApproval FROM AdCampaignPreview) AS tb4 ON (tb3.UserID = tb4.UserID AND tb3.AdCampaignPreviewID = tb4.AdCampaignID);";

		connection.query(q, function(err, rows, fields) {
			if (err || !rows) throw err;
			// console.log("==== query ok =====");

			rows.forEach(function(row, i) {
			//for (var i in rows) {
				// console.log("==== IN ROW "+ i +" ====================================", row);
				// var row = rows[i];

				// Check user is in agent list ?
				var isExists = false;
				for (var jj in BGateAgent.agents) {
					if (isExists) return false;
					if (BGateAgent.agents[jj].UserID == row.user_id) isExists = true;
				}

				if (!isExists) {
					var agent = {
						UserID 					: row.user_id,
						user_email 				: row.user_email,
						user_enabled 			: row.user_enabled,
						user_verified 			: row.user_verified,
						user_agreement_accepted	: row.user_agreement_accepted,
						locale					: row.locale,
						Name 					: row.Name,
						Website 				: row.Website,
						Company 				: row.Company,
						PartnerType 			: row.PartnerType,
						Balance 				: row.Balance,
						banner 					: [], 
						campaign 				: []
					};

					// Load campaign
					
					var agentCampaign = [];
					for (var jjj in rows) {
						if (rows[jjj].user_id == row.user_id) {
							var _isExistsCampaign = false;
							agentCampaign.forEach(function(campaign) {
								if (_isExistsCampaign == true) return false;
								if (campaign.AdCampaignID == rows[jjj].AdCampaignID) _isExistsCampaign = true;
							});

							if (!_isExistsCampaign) {
								var _rowCampaign = rows[jjj];

								var campaign = initCampainAttributes({
									AdCampaignID 					: _rowCampaign.AdCampaignID,
									CampaignName 					: _rowCampaign.CampaignName,
									CampaignMarkup 					: _rowCampaign.CampaignMarkup,
									CampaignStartDate 				: _rowCampaign.CampaignStartDate,
									CampaignEndDate 				: _rowCampaign.CampaignEndDate,
									CampaignImpressionsCounter 		: _rowCampaign.CampaignImpressionsCounter,
									CampaignMaxImpressions 			: _rowCampaign.CampaignMaxImpressions,
									CampaignCurrentSpend 			: _rowCampaign.CampaignCurrentSpend,
									CampaignMaxSpend 				: _rowCampaign.CampaignMaxSpend,
									CampaignCPMTarget 				: _rowCampaign.CampaignCPMTarget,
									CampaignCPMTargetValue			: _rowCampaign.CampaignCPMTargetValue,
									CampaignActive 					: _rowCampaign.CampaignActive,
									CampaignDeleted 				: _rowCampaign.CampaignDeleted,
									CampaignDateCreated 			: _rowCampaign.CampaignDateCreated,
									CampaignDateUpdated 			: _rowCampaign.CampaignDateUpdated,
									CampaignChangeWentLive 			: _rowCampaign.CampaignChangeWentLive,
									CampaignWentLiveDate 			: _rowCampaign.CampaignWentLiveDate,
									CampaignApproval 				: _rowCampaign.CampaignApproval
								});

								if (passSelfCampaignFilter(campaign)) {
									agentCampaign.push(campaign);
								}
							}
						}
					}
					agent.campaign = agentCampaign;

					// Load banner 
					for (var j in rows) {
						//console.log("==== GET BANNER OF "+ i +" ====");
						// Check banner is in array 
						if (rows[j].user_id == row.user_id) {
							//console.log("PASS USER ", row.user_id);
							var _isExists = false;
							agent.banner.forEach(function(banner) {
								if (_isExists == true) return false;
								if (banner.AdCampaignBannerPreviewID == rows[j].AdCampaignBannerPreviewID) {
									_isExists = true;
									// return false;
								}
							});

							if (!_isExists) {
								
								var _rowBanner = rows[j];
								var banner = initBannerAttributes({
									AdCampaignBannerPreviewID: _rowBanner.AdCampaignBannerPreviewID,
									AdCampaignID: _rowBanner.AdCampaignID,
									ImpressionType: _rowBanner.ImpressionType,
									Name: _rowBanner.Name, 
									StartDate: _rowBanner.StartDate, 
									EndDate: _rowBanner.EndDate,
									IsMobile: _rowBanner.IsMobile, 
									IABSize: _rowBanner.IABSize,
									Height: _rowBanner.Height,
									Width: _rowBanner.Width,
									Weight: _rowBanner.Weight,
									BidAmount: _rowBanner.BidAmount,
									DeliveryType: _rowBanner.DeliveryType,
									LandingPageTLD: _rowBanner.LandingPageTLD,
									ImpressionsCounter: _rowBanner.ImpressionsCounter,
									BidsCounter: _rowBanner.BidsCounter,
									CurrentSpend: _rowBanner.CurrentSpend,
									Active: _rowBanner.Active,
									DateCreated: _rowBanner.DateCreated,
									DateUpdated: _rowBanner.DateUpdated,
									ChangeWentLive: _rowBanner.ChangeWentLive,
									WentLiveDate: _rowBanner.WentLiveDate, 
									AdUrl: _rowBanner.AdUrl,
									Label: _rowBanner.Label,
									BidType: _rowBanner.BidType,
									TargetDaily: _rowBanner.TargetDaily,
									TargetMax: _rowBanner.TargetMax,
									DailyBudget: _rowBanner.DailyBudget,
									MaximumBudget: _rowBanner.MaximumBudget,
									IABAudienceCategory: _rowBanner.IABAudienceCategory,
									GEOCountry: _rowBanner.GEOCountry, 
									TimeZone: _rowBanner.TimeZone,
									FrequencyCap: _rowBanner.FrequencyCap, 
									FreCapShowTime: _rowBanner.FreCapShowTime,
									FreCapTimeFromHr: _rowBanner.FreCapTimeFromHr,
									FreCapTimeToHr: _rowBanner.FreCapTimeToHr, 
									FreCapCampaignApply: _rowBanner.FreCapCampaignApply,
									FreCapZoneApply: _rowBanner.FreCapZoneApply,
									AdTagType: _rowBanner.AdTagType,
									InAnIframe: _rowBanner.InAnIframe,
									MultiNestedIframe: _rowBanner.MultiNestedIframe,
									AdPostLeft: _rowBanner.AdPostLeft,
									AdPostTop: _rowBanner.AdPostTop,
									ResolutionMinW: _rowBanner.ResolutionMinW,
									ResolutionMaxW: _rowBanner.ResolutionMaxW, 
									ResolutionMinH: _rowBanner.ResolutionMinH,
									ResolutionMaxH: _rowBanner.ResolutionMaxH,
									HttpLang: _rowBanner.HttpLang,
									BrowerAgentGrep: _rowBanner.BrowerAgentGrep,
									CookieGrep: _rowBanner.CookieGrep,
									PmpEnable: _rowBanner.PmpEnable,
									Secure: _rowBanner.Secure,
									FoldPosition: _rowBanner.FoldPosition,
								});

								if (passSelfBannerFilter(banner)) {
									agent.banner.push(banner);
								}

							}
						}
					}

					BGateAgent.agents.push(agent);
				}
			});
			// console.log(BGateAgent.agents);

			if (next) next();
		});
	}
};



var passSelfBannerFilter = function(banner) {
	if (!banner) return false;

	if (banner.StartDate) {
		var startDate = moment(banner.StartDate);
		if (moment().diff(startDate, "seconds") < 0) return false; 
	}

	if (banner.EndDate) {
		var endDate = moment(banner.EndDate);
		if (moment().diff(endDate, "seconds") > 0) return false; 
	}

	// Check campaign status, if campaign is disable ==> disable me
	var campaign = getCampaignById(banner.AdCampaignID);
	if (!campaign) {
		// not found campaign, opp
		console.error("passSelfBannerFilter: not found campaign ", banner.AdCampaignID);
		// return false;
	}
	if (!campaign.CampaignActive || campaign.CampaignActive == 0) {
		banner.BannerActive = 0;
		// If return false here ==> do not add this banner to agents
	}

	return true;
};

var initBannerAttributes = function(banner) {
	if (!banner) return banner;

	if (banner.FrequencyCap == 1) {
		banner.FrequencyCapCountToday = banner.FrequencyCapCountToday || 0;
		banner.FreCapShowTime = parseInt(banner.FreCapShowTime);
		if (!banner.FreCapShowTime || banner.FreCapShowTime == 0) {
			banner.currentFreCapShowTime = 300; // default 3 time in day
		} else {
			banner.currentFreCapShowTime = banner.FreCapShowTime;
		}
	}

	// Banner status 
	banner.BannerActive = 1;
	banner.BannerActiveStatus = "";

	// TODO: All attributes for banner, ex: todayImp, totalImp, clickCounter, ...
	return banner;
};

var passSelfCampaignFilter = function(campaign) {
	// TODO: Check campagin conditions

	return true;
}

var initCampainAttributes = function(campaign) {
	// TODO: Add campaign attr

	return campaign;
}

// ----------------
var getCampaignById = function(campaignId) {
	if (!BGateAgent || !BGateAgent.agents) return false;
	var isFounded = false;
	var result = {};

	BGateAgent.agents.forEach(function(agent) {
		// console.error(agent);
		if (isFounded) return false;
		if (!agent.campaign) return false;

		agent.campaign.forEach(function(campaign) {
			if (isFounded) return false;
			if (campaign.AdCampaignID == campaignId) {
				isFounded = true;
				result = campaign;
			}
		});
	});

	if (isFounded) return result;
	return false;
}


BGateAgent.init(function() {
	if (1 == 1) {
		setTimeout(function() {
			require('fs').writeFile("bgate_agent.txt", JSON.stringify(BGateAgent.agents, null, 4), null);
		}, 2000);
	}
});

module.exports = BGateAgent;