/* @phase23-module-order:core/chinese-search */
/* @phase23-order-link:core/chinese-search<-core/data-manager */
import { onTablesReady, resolveByZh, resolvePartialByZh, suggestByZh } from './data-manager.js';
import { resolveECGearsetSearch, suggestECGearsetsByZh } from '../sites/eorzea-collection.js';

// 站点能力表：统一交互由 Core 调度；form 与 SPA 输入的提交路径各用原站行为。
const SEARCH_SITES = Object.freeze({
  mirapri: { vueSelect: false },
  fc: { vueSelect: false },
  ronka: { vueSelect: false },
  collection: { vueSelect: false },
  ec: { vueSelect: true },
  endcloset: { vueSelect: false },
});
let _activeSearchSiteId = null;

// BEGIN GENERATED EC SEARCH CATEGORIES — tools/update-ec-search-categories.py
// EC 分类严格取自游戏数据表，不从名称模糊推断。
// 鸟甲：Item.csv 的 ItemAction 对应 Action=1013，包含 Shaffron、Harness。
// 面饰：Glasses.csv 按 Style 去重，再依据记录 ID 对应国服名称。
// 饰品：Item.csv 的 EquipSlotCategory 为 9/10/11/12。
// 面饰来自独立数据表，不能当作头部防具。
// 相邻名称按共同前缀长度（36 进制）与剩余后缀储存，仅在加载时解码。
function decodeEcNativeNames(packed) {
  const out = [];
  let previous = '';
  for (const row of packed.split('\n')) {
    const separator = row.indexOf(':');
    const prefix = Number.parseInt(row.slice(0, separator), 36);
    const name = previous.slice(0, prefix) + row.slice(separator + 1);
    out.push(name);
    previous = name;
  }
  return out;
}
const EC_BARDING_NATIVES = new Set(decodeEcNativeNames("0:Abigail Barding\n2:yssal Barding\n1:la Mhigan Barding\n2:lagan Barding\n1:ngelic Barding\n1:uthentic Egg Barding\na:Paramour Barding\na:Starlight Barding\n0:Barding of Divine Light\nb:Eternal Darkness\nb:Light\nb:Naught\nb:the Dead\n1:ehemoth Barding\n1:lack Mage Barding\n2:issful Barding\n2:uefeather Barding\n1:ozjan Barding\n1:utlery Barding\n1:yakko Barding\n0:Chocobo Raincoat\n1:osmic Barding\n0:Dancer Barding\n1:eepshadow Barding\n2:monic Barding\n1:iamond Barding\n0:Eerie Barding\n1:gg Harness\n5:unter Barding\n1:lectrope Barding\n1:merald Barding\n1:ternal Barding\n1:xpanse Barding\n0:Far Eastern Barding\n1:elicitous Barding\n1:lamecloaked Barding\n2:yer Shaffron\n0:Gambler Barding\n1:ridanian Barding\na:Crested Barding\na:Half Barding\n0:Hades Barding\n1:ighland Barding\n2:ngan Barding\n2:ve Barding\n1:orde Barding\n0:Ice Barding\n1:nnocence Barding\n1:shgardian Barding\nb:Half Barding\n2:le Pioneer's Barding\n1:xion Barding\n0:Levin Barding\n1:ominsan Barding\n9:Crested Barding\n9:Half Barding\n1:unar Barding\n0:Machinist Barding\n2:ndervillian Barding\n0:Nezha Barding\n1:oble Barding\n0:Oriental Barding\n2:thodox Barding\n0:Paramour Barding\n1:icnicker's Barding\n2:lgrim's Barding\n1:lumed Barding\n1:ostmoogle Barding\n0:Queen's Guard Barding\n8:Knight Barding\n0:Race Barding\n1:ed Mage Barding\n2:veler's Barding\n1:ound Table Barding\n1:uby Barding\n2:naway Barding\n0:Saintly Barding\n2:murai Barding\n1:eiryu Barding\n2:phirotic Barding\n1:hinryu Barding\n1:kyruin Barding\n1:leipnir Barding\n1:ophic Barding\n2:vereign Barding\n1:tarlight Barding\na:Stalls Barding\n1:uzaku Barding\n0:Thavnairian Barding\n1:idal Barding\n2:tania Barding\n1:rue Barding of Light\n1:urali Barding\n0:Ul'dahn Barding\n8:Crested Barding\n8:Half Barding\n0:Voidcast Barding\n0:Wayfarer's Barding\n1:ild Ride Barding\n6:ose Barding\n2:ndswept Barding\n1:olf Barding\n0:Yojimbo Barding\n0:Zurvanite Barding"));
const EC_FACEWEAR_ROWS = Object.freeze([{"native":"Antique Monocle","zh":"古董单眼镜"},{"native":"Blindfold Eyepatch (Left)","zh":"左侧折布眼罩"},{"native":"Blindfold Eyepatch (Right)","zh":"右侧折布眼罩"},{"native":"Blooming Eyeglasses","zh":"彩花装饰眼镜"},{"native":"Bold-rimmed Glasses","zh":"厚框眼镜"},{"native":"Brass Goggles","zh":"黄铜护目镜"},{"native":"Cat Eye Glasses","zh":"猫眼眼镜"},{"native":"Cat Eye Reading Glasses","zh":"猫眼读书眼镜"},{"native":"Chicken Eyeglasses","zh":"彩蛋小鸡眼镜"},{"native":"Classic Spectacles","zh":"经典眼镜"},{"native":"Coeurl Eyeglasses","zh":"豹目眼镜"},{"native":"Comfortable Eye Mask","zh":"纯色眼罩"},{"native":"Contemporary Pince-nez","zh":"现代鼻眼镜"},{"native":"Dark Glasses","zh":"黑色墨镜"},{"native":"Elegant Rimless Glasses","zh":"典雅无框眼镜"},{"native":"Eyepatch (Left)","zh":"左侧眼罩"},{"native":"Eyepatch (Right)","zh":"右侧眼罩"},{"native":"Groovy Glasses","zh":"时髦眼镜"},{"native":"Half-rim Spectacles","zh":"半框眼镜"},{"native":"Holospecs","zh":"全息眼镜"},{"native":"Holovisor","zh":"全息护目镜"},{"native":"Magnifiers","zh":"作业眼镜"},{"native":"Metallic Eyepatch (Left)","zh":"左侧金属眼罩"},{"native":"Metallic Eyepatch (Right)","zh":"右侧金属眼罩"},{"native":"Minstrel's Spectacles","zh":"艺术眼镜"},{"native":"Monocle","zh":"单眼镜"},{"native":"Mythril-edged Eyepatch (Left)","zh":"左侧秘银镶边眼罩"},{"native":"Mythril-edged Eyepatch (Right)","zh":"右侧秘银镶边眼罩"},{"native":"Ornamented Leather Eyepatch (Left)","zh":"左侧皮饰眼罩"},{"native":"Ornamented Leather Eyepatch (Right)","zh":"右侧皮饰眼罩"},{"native":"Oval Reading Glasses","zh":"椭圆读书眼镜"},{"native":"Oval Spectacles","zh":"椭圆眼镜"},{"native":"Painted Eggy Eyeglasses","zh":"装饰彩蛋眼镜"},{"native":"Party Eggy Eyeglasses","zh":"四颗彩蛋眼镜"},{"native":"Petite Pince-nez","zh":"小夹鼻眼镜"},{"native":"Pince-nez","zh":"鼻眼镜"},{"native":"Professorial Glasses","zh":"教授眼镜"},{"native":"Reading Glasses","zh":"阅读眼镜"},{"native":"Rectangular Glasses","zh":"渐变色镜框眼镜"},{"native":"Rimless Glasses","zh":"无框眼镜"},{"native":"Rose-colored Spectacles","zh":"玫瑰色眼镜"},{"native":"Sash Blinder (Left)","zh":"左侧皮带眼罩"},{"native":"Sash Blinder (Right)","zh":"右侧皮带眼罩"},{"native":"Scaevan Headgear","zh":"斯卡艾瓦头甲"},{"native":"Shaded Spectacles","zh":"金边墨镜"},{"native":"Shaded Visor","zh":"遮光面罩"},{"native":"Simple Oval Spectacles","zh":"基础款椭圆眼镜"},{"native":"Simple Spectacles","zh":"基础款眼镜"},{"native":"Slim Frame Eggy Eyeglasses","zh":"窄框彩蛋眼镜"},{"native":"Slim Frame Glasses","zh":"窄框眼镜"},{"native":"Spriggan Eyeglasses","zh":"魔石精眼镜"},{"native":"Studded Eyepatch (Left)","zh":"左侧钉扣眼罩"},{"native":"Studded Eyepatch (Right)","zh":"右侧钉扣眼罩"},{"native":"Tactical Goggles","zh":"战术护目镜"},{"native":"Teardrop Glasses","zh":"泪滴形眼镜"},{"native":"Thick-rimmed Glasses","zh":"粗框眼镜"},{"native":"Thick-rimmed Goggles","zh":"厚框护目镜"},{"native":"Tinted Goggles","zh":"彩色护目镜"},{"native":"Tinted Sunglasses","zh":"淡色眼镜"},{"native":"Under-rim Glasses","zh":"下框眼镜"},{"native":"Wrap-around Sunglasses","zh":"罩眼式墨镜"}]);
const EC_ACCESSORY_SLOT_NATIVES = Object.freeze({"ears":new Set(decodeEcNativeNames("0:Abyssos Earrings of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:cacia Earrings\n1:esthete's Ear Cuffs of Crafting\ne:rings of Gathering\n2:therial Amber Earrings\nc:ethyst Earrings\nb:quamarine Earrings\na:Black Pearl Earrings\nb:rass Ear Cuffs\na:Danburite Earrings\na:Electrum Ear Cuffs\na:Fluorite Earrings\na:Garnet Earrings\nb:oshenite Earrings\na:Heliodor Earrings\na:Lapis Lazuli Earrings\na:Malachite Earrings\nb:ythril Ear Cuffs\na:Pearl Earrings\nc:ridot Earrings\na:Rubellite Earrings\na:Silver Ear Cuffs\nb:phene Earrings\nc:inel Earrings\nb:unstone Earrings\na:Tourmaline Earrings\nb:urquoise Earrings\na:Zircon Earrings\n6:yte Earring\n1:la Mhigan Earrings\nj: of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:exandrian Earrings of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:lagan Earrings of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Maiming\nk:Striking\n3:iance Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:paca Earring\n3:ha Wolf Earrings\n1:maurotine Earrings of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:ber Earrings\n2:ethyst Earrings\n4:rine Ear Cuffs of Crafting\nc:rings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:nabaseios Earring of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n3:mnesis Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:quamarine Earrings\n1:rcheo Kingdom Earrings of Aiming\nr:Casting\nr:Fending\nr:Healing\nr:Slaying\n2:dent Earrings of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:hat Earring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:tful Afflatus Earrings\n1:scension Earring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:phodelos Earrings of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:uran Earring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:ugmented Archeo Kingdom Earrings of Aiming\n11:Casting\n11:Fending\n11:Healing\n11:Slaying\na:Bygone Brass Earrings of Aiming\nz:Casting\nz:Fending\nz:Healing\nz:Slaying\na:Ceremonial Earring of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\nb:lassical Earrings of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\nb:ourtly Lover's Earrings of Aiming\n12:Casting\n12:Fending\n12:Healing\n12:Slaying\nb:redendum Earrings of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\nc:yptlurker's Earring of Aiming\nz:Casting\nz:Fending\nz:Healing\nz:Slaying\nd:starium Earrings of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\na:Deepshadow Earring of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\nb:iadochos Earring of Aiming\nv:Casting\nv:Fending\nv:Healing\nv:Slaying\na:Exarchic Earrings of Aiming\nv:Casting\nv:Fending\nv:Healing\nv:Slaying\na:Facet Earrings of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\na:Handmaster's Earrings\nb:istoria Earrings of Aiming\nv:Casting\nv:Fending\nv:Healing\nv:Slaying\na:Ironworks Earrings of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\na:Landmaster's Earrings\nb:ost Allagan Earrings of Aiming\nz:Casting\nz:Fending\nz:Healing\nz:Slaying\nb:unar Envoy's Earring of Aiming\nz:Casting\nz:Fending\nz:Healing\nz:Slaying\na:Neo-Ishgardian Earring of Aiming\n10:Casting\n10:Fending\n10:Healing\n10:Slaying\na:Primal Earrings of Aiming\nt:Casting\nt:Fending\nt:Healing\nt:Slaying\na:Quetzalli Ear Cuffs of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\na:Radiant's Earrings of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\nb:inascita Earring of Aiming\nv:Casting\nv:Fending\nv:Healing\nv:Slaying\na:Scaevan Ear Cuff of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\nb:hire Conservator's Earrings\nh:ustodian's Earrings\ng:Pankratiast's Earring\nh:hilosopher's Earring\nh:receptor's Earrings\nb:ilvergrace Earring of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\n2:roral Earrings\n3:um Regis Earrings of Aiming\no:Casting\np:rafting\no:Fending\no:Gathering\no:Healing\no:Slaying\n1:valanche Brawler's Earring\na:Leader's Earring\n1:zeyma's Earrings\n2:urite Earrings of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n0:Babyface Champion's Earring of Aiming\nv:Casting\nv:Fending\nv:Healing\nv:Slaying\n2:ron Earrings\n2:ttleliege Earrings of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n1:eastmaster's Earrings\n2:hemoth Earring\n2:rserker's Earrings\n1:lack Carnation Earring\n6:Moth Orchid Earring\n6:Paperflower Earring\n7:earl Earrings\n6:Star Ear Cuff of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\ne:rings of Crafting\nn:Gathering\n6:Triteleia Earring\n2:essed Earrings\n2:ue Carnation Earring\n5:Moth Orchid Earring\n5:Paperflower Earring\n5:Triteleia Earring\n5:Zircon Earrings of Aiming\no:Casting\no:Fending \no:Healing\no:Slaying\n4:bird Earring\n1:ogatyr's Earrings of Aiming\nm:Casting\nm:Healing\n2:mb Earrings\n2:newicca Earring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:tanist's Earrings\n2:zjan Earring\n1:rass Ear Cuffs\n9:rings\n2:illiant Egg Earrings\n2:onze Lone Wolf Earrings\n7:Pack Wolf Earrings\n1:uuz Earring\n1:ygone Brass Earrings of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n0:Cactuar Earring\n2:rborundum Earring of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:ssie Earring\n1:eremonial Earring of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:hrysolite Earrings of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n1:lassical Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:oblyn Earring\n2:ffee Cup Earring\n2:okie Earring\n2:pper Ear Cuffs\na:rings\n2:rgi Earring\n2:urtly Lover's Earrings of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\n1:redendum Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n3:sted Earrings of Crafting\nk:Gathering\n2:imson Standard Earrings\n2:uiser Earring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:yptlurker's Earring of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n3:starium Earrings of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n0:Dai-ryumyaku Earring of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:nburite Earrings\n2:rbar Earrings of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n3:k Horse Champion's Earring of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\n4:light Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Maiming\nm:Striking\n2:ted Amethyst Earrings\n7:quamarine Earrings\n6:Black Pearl Earrings\n7:rass Earrings\n6:Copper Earrings\n6:Danburite Earrings\n6:Electrum Earrings\n6:Fang Earrings\n7:luorite Earrings\n6:Garnet Earrings\n7:oshenite Earrings\n6:Heliodor Earrings\n6:Lapis Lazuli Earrings\n6:Malachite Earrings\n6:Pearl Earrings\n8:ridot Earrings\n6:Silver Earrings\n7:phene Earrings\n7:unstone Earrings\n2:ystar Earrings\n1:eepmist Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n4:shadow Earring of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:magogue Earrings\n3:on Brick Earring\n1:iadochos Earring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n3:mond Earring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\nf:s\n8:Lone Wolf Earrings\n8:Pack Wolf Earrings\n3:spore Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:rewolf Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:stance Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:odo Earring\n2:nut Earring\n1:ragon Fang Earrings\n3:vanian Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:eadwyrm Earring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:warven Mythril Ear Cuffs\n0:Earrings of Divine Death\nj:Wisdom\nc:the Daring Duelist\nh:efiant Duelist\nh:ivine Harvest\nn:Light\nn:War\ng:First Light\ng:Lost Thief\ng:Sea-folk\n1:dencall Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n5:hoir Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n4:gate Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n5:race Earring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n4:mete Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n5:orn Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:gg Earrings\n1:ikon Iron Earring of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:lectrum Ear Cuffs\nc:rings\n1:merald Carbuncle Earring\n8:Earrings\n2:pyrean Earring\n1:n Fortune-teller's Earrings\n2:aretos Earrings\n1:pochal Earrings of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:ternal Dark Earrings of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n2:heirys Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:venstar Earrings\n3:rsharp Earring\n1:xarchic Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:plorer's Earrings\n0:Fabled Earrings of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:cet Earrings of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:ng Earrings\n2:rlander Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:t Cat Earrings\n2:ux Commander Earring\n1:ilibuster's Earring of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:recrest Earring\n2:sher's Earrings\n1:lame Sergeant's Ear Cuffs\nk:rings\n2:uorite Earrings\n0:Garnet Earrings\n2:zelleskin Earrings\n1:enji Earrings of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n3:ta Earrings of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:host Barque Earrings of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:inseng Earring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\nf:s\n1:lass Pumpkin Earring\n2:oam Earrings\n1:old Lone Wolf Earrings\n5:Pack Wolf Earrings\n2:mphotherium Earrings\n2:obbue Earring\n2:rdian Earrings of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:shenite Earrings\n1:rand Champion's Ear Cuff of Aiming\nt:Casting\nt:Fending\nt:Healing\nt:Slaying\n2:een Carnation Earring\n6:Moth Orchid Earring\n6:Paperflower Earring\n6:Triteleia Earring\n1:yuki Leather Earrings\n0:Halone's Earring\n5:ic Auditor's Earrings\n8:Exorcist's Earrings\n8:Friar's Earrings\n8:Inquisitor's Earrings\n8:Priest's Earrings\n2:ndking's Earring\n4:master's Earrings\n4:saint's Earrings\n2:rdsilver Earrings of Aiming\nn:Casting\nn:Fending\nn:Gathering\nn:Healing\nn:Slaying\n2:tchling Earring\n1:eavyweight Ear Cuff of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:irloom Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:liodor Earrings\n3:lwolf Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:matite Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:ro's Earrings of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:igh Allagan Earrings of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n2:storia Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:oplite Earrings\n2:rn Earrings\n3:se Chestnut Earrings of Gathering\n0:Ihuykanite Earring of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:mmaculate Ear Cuffs of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:perial Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n9:Jade Earrings of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n1:ndagator's Earrings of Crafting\no:Gathering\n2:tegral Earrings of Crafting\n1:olite Earrings\n1:ronwood Earrings of Crafting\n6:rks Earring of Crafting\nl:Gathering\nh:s of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:shgardian Chaplain's Earrings\nb:Historian's Earrings\nb:Knight's Earrings\nb:Monastic's Earrings\nb:Outrider's Earrings\n0:Koppranickel Earrings of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:tiseos Earring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:umbhiraskin Earrings of Gathering\n0:Lakeland Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n3:shmi's Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:ndking's Earring\n4:master's Earrings\n4:saint's Earrings\n2:pis Lazuli Earrings\n2:r Ear Cuffs\n3:ch Earrings\n1:ight-heavy Earring of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n3:num Vitae Earrings\n2:ly and Serpent Earrings\n2:mbo Earrings of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:one Faehound Earring\n5:Hellhound Earring\n2:porrit Earrings\n2:st Allagan Earrings of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:unar Envoy's Earring of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n0:Mage's Earrings\n2:kai Earring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:lachite Earrings\n2:meshiba Earring\n2:nalis Earrings of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n4:silver Ear Cuffs\n3:derville Earrings\n3:usya Earrings of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:rid Leather Earrings\n1:enphina's Earring\n1:idan Earrings of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n3:night Egg Earrings\n2:litia Earrings\n2:ner's Earring\n2:rage Earring\n2:stbreak Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n4:fall Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n4:ic Memory Earrings of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n4:wake Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:olybdenum Earring of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:ogle Earrings\n3:nlet\n4:ward Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:sshorn Earrings\n1:ythril Ear Cuffs\nb:rings\n6:te Earblades of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\nc:rings of Aiming\nl:Casting\nl:Fending\nl:Gathering\nl:Healing\nl:Slaying\n0:Nabaath Earrings of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:mazu Earring\n2:tural Afflatus Earrings\n1:eo Kingdom Earrings of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n3:-Ishgardian Earring of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n1:oct Earrings\n2:mad's Earrings of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n0:Occult Earrings of Blood\nj:Magic\n1:mega Ear Cuff of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n5:-F Earrings\n6:M Ear Cuffs\n2:icron Ear Cuff of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:pal Earrings of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:hiotauroskin Earrings of Gathering\n1:range Carnation Earring\n7:Moth Orchid Earring\n7:Paperflower Earring\n7:Triteleia Earring\n2:igenics Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:thodox Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n0:Pack Faehound Earring\n5:Hellhound Earring\n2:glth'an Earring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:issa Earring\n2:laka Earrings of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n3:ladium Earring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n3:m Ear Cuffs of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:negyrist's Earrings\n2:ramour's Earrings\n1:each Blossoms\n3:rl Earrings\n2:ltast Earrings\n2:ridot Earrings\n3:simmon Earrings\n2:talite Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:hantasmal Sardine Earring\n2:rygian Ear Cuffs of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:icaroon's Earrings of Slaying\n2:nk Beryl Earrings of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:xie Earrings\n1:lague Bringer's Earrings\n7:Doctor's Earrings\n3:tinum Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n9:Lone Wolf Earrings\n9:Pack Wolf Earrings\nb:ramour's Earrings\n2:undered Ear Cuffs\nd:rings\n1:orxie Earrings\n1:raemagitek Earrings of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:imal Earrings of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:ophet's Earrings\n3:to Ultima Earrings of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n5:type Alexandrian Earrings of Aiming\ny:Casting\ny:Fending\ny:Healing\ny:Slaying\na:Gordian Earrings of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\na:Midan Earrings of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\n1:umpkin Earrings\n2:rgatory Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n3:ple Carnation Earring\n7:Moth Orchid Earring\n7:Paperflower Earring\n7:Triteleia Earring\n0:Qiqirn Earring\n1:uetzalli Ear Cuffs of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n0:Radiant's Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:inbow Carnation Earring\n8:Moth Orchid Earring\n8:Paperflower Earring\n8:Triteleia Earring\n2:kshasa Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:vel Keeper's Earring of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n1:ealm-roamer's Earrings\n2:d Carnation Earring\n5:oral Earrings\n4:Moth Orchid Earring\n4:Paperflower Earring\n4:Triteleia Earring\n2:plica Manderville Earrings\n8:White Ravens\n2:silient Earring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:inascita Earring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:versbreath Earring of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n1:onkan Earrings of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:se Gold Ear Cuffs\ne:Screws\nd:rings\ni: of Gathering\n2:yal Volunteer's Earrings of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\n1:ubellite Earrings\n3:y Earrings\n5:Tide Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:yumyaku Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n0:Sapphire Earrings\n1:caevan Ear Cuff of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:intillant Earring of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n3:on Liberator's Earrings\n1:erpent Sergeant's Ear Cuffs\nm:rings\n1:hadowless Earrings of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n3:rlayan Conservator's Earrings\nb:ustodian's Earrings\na:Pankratiast's Earrings\nb:hilosopher's Earrings\nb:receptor's Earrings\n2:ire Conservator's Earrings\n7:ustodian's Earrings\n6:Pankratiast's Earring\n7:hilosopher's Earring\n7:receptor's Earrings\n1:il'dihn Earring\n3:kie Earring\n3:ver Ear Cuffs\na:rings\n7:Lone Wolf Earrings\n7:Pack Wolf Earrings\n6:grace Earring of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\nj:s of Crafting\no:Gathering\n1:kallic Earring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:ydeep Earrings of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:lime Earrings\n1:milodonskin Earrings\n1:phene Earrings\n2:inel Earrings\n2:riggan Earrings\n1:tar Quartz Earrings of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n5:Spinel Earrings of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n5:Tech Ear Cuff of Crafting\nm:Gathering\n2:onewall Earrings\n3:rm Sergeant's Ear Cuffs\nk:rings\n2:rategos Earrings\n1:unburst Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n3:stone Earrings\n5:reak Earring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n0:The Emperor's New Earrings\n4:Forgiven's Earrings of Aiming\nr:Casting\nr:Fending\nr:Healing\nr:Slaying\n4:Last Earring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n4:Twelve's Earrings of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n4:Warden's Earring\n1:ipping Scales Earrings\n1:opaz Carbuncle Earring\n6:Earrings\n2:urmaline Earrings\n2:xotes Earrings\n1:remor Earrings of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:iphane Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n4:lite Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:oian Earrings of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:urquoise Earrings\n0:Underkeep Earrings of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:olosapa Earring\n0:Valerian Archer's Earrings\n9:Brawler's Earrings\n9:Dark Priest's Earrings\n9:Fusilier's Earrings\n9:Priest's Earrings\n9:Shaman's Earrings\na:muggler's Earrings\n9:Terror Knight's Earrings\n9:Wizard's Earrings\n3:kyrie's Earrings of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:nguard Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:rlet's Earrings\n1:ibrant Egg Earrings\n2:king Earrings\n1:oeburtite Earring of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:ice of the Just\n3:dmoon Ear Cuffs of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n0:Warg Earring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n3:wolf Earrings of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:yfarer's Earcuff\n1:eathered Auroral Earrings\na:Daystar Earrings\na:Earrings\nb:venstar Earrings\na:Gloam Earrings\na:Noct Earrings\n2:rewolf Earrings of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:halaqee Earrings\n2:ite Ash Earring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\nh:s\n6:Carnation Earring\n6:Gold Earrings of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n6:Moth Orchid Earring\n6:Oak Earrings\n6:Paperflower Earring\n6:Ravens\n6:Triteleia Earring\n1:oad Skydruid's Earrings\n8:hunter's Earrings\n8:raider's Earrings\n8:warrior's Earrings\n9:icce's Earrings\n2:lf Amber Earrings\n5:Earrings\n5:Rubellite Earrings\n5:Spinel Earrings\n5:Tourmaline Earrings\n6:urquoise Earrings\n5:Zircon Earrings\n1:rangler's Earrings\n0:Xenobian Paladin's Earrings\n0:Yama Earring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n2:nxian Earring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:sha Earring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:ellow Carnation Earring\n7:Moth Orchid Earring\n7:Paperflower Earring\n7:Triteleia Earring\n2:ti Fang Earrings\n1:uweyawata Earrings of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n0:Zelkova Earrings\n2:ro's Order Earring\n1:ircon Earrings\n1:ormor Earrings of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying")),"neck":new Set(decodeEcNativeNames("0:Abyssos Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:cacia Necklace\n1:esthete's Choker of Crafting\nb:Necklace of Gathering\n2:therial Amber Choker\nc:ethyst Choker\nb:quamarine Choker\na:Black Pearl Choker\nb:rass Gorget\na:Danburite Choker\na:Electrum Gorget\na:Fang Necklace\nb:luorite Choker\na:Garnet Choker\nb:oshenite Choker\na:Heliodor Choker\nb:orn Necklace\na:Lapis Lazuli Choker\na:Malachite Choker\nb:ythril Gorget\na:Pearl Choker\nc:ridot Choker\na:Red Coral Necklace\nb:ubellite Choker\na:Silver Gorget\nb:phene Choker\nc:inel Choker\nb:unstone Choker\na:Tourmaline Choker\nb:urquoise Choker\na:Wolf Necklace\na:Zircon Choker\n1:hriman Choker\n1:la Mhigan Necklace of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:exandrian Neckband of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:lagan Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Maiming\ni:Striking\n3:iance Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:paca Neck Warmer\n3:ha Wolf Choker\n1:maurotine Choker of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:ber Choker\n2:ethyst Choker\n4:rine Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n9:Necklace of Crafting\n1:nabaseios Necklace of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n3:mnesis Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:quamarine Choker\n1:rcheo Kingdom Choker of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n2:dent Necklace of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:hat Necklace of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:tful Afflatus Necklace\n1:scension Necklace of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:phodelos Necklace of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:tral Birch Necklace\n7:Choker\n2:uran Necklace of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:trociraptorskin Necklace of Aiming\nt:Casting\nt:Fending\nt:Healing\nt:Slaying\n1:ugmented Archeo Kingdom Choker of Aiming\nz:Casting\nz:Fending\nz:Healing\nz:Slaying\na:Black Willow Necklace of Aiming\nz:Casting\nz:Fending\nz:Healing\nz:Slaying\nb:ygone Brass Choker of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\na:Ceremonial Necklace of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\nb:lassical Choker of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\nb:ourtly Lover's Choker of Aiming\n10:Casting\n10:Fending\n10:Healing\n10:Slaying\nb:redendum Necklace of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\nc:yptlurker's Choker of Aiming\ny:Casting\ny:Fending\ny:Healing\ny:Slaying\nd:starium Choker of Aiming\nv:Casting\nv:Fending\nv:Healing\nv:Slaying\na:Deepshadow Necklace of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\nb:iadochos Choker of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\na:Exarchic Choker of Aiming\nt:Casting\nt:Fending\nt:Healing\nt:Slaying\na:Facet Choker of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\na:Handmaster's Necklace\nb:istoria Choker of Aiming\nt:Casting\nt:Fending\nt:Healing\nt:Slaying\na:Ironworks Choker of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\na:Landmaster's Choker\nb:ost Allagan Choker of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\nb:unar Envoy's Necklace of Aiming\n10:Casting\n10:Fending\n10:Healing\n10:Slaying\na:Neo-Ishgardian Choker of Aiming\nz:Casting\nz:Fending\nz:Healing\nz:Slaying\na:Primal Choker of Aiming\nr:Casting\nr:Fending\nr:Healing\nr:Slaying\na:Quetzalli Necklace of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\na:Radiant's Choker of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\nb:inascita Necklace of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\na:Scaevan Choker of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\nb:hire Conservator's Choker\nh:ustodian's Choker\ng:Pankratiast's Choker\nh:hilosopher's Choker\nh:receptor's Choker\n2:roral Choker\n3:um Regis Necklace of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n1:zurite Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n0:Babyface Champion's Gorget of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\n2:nd of Eternal Passion\n2:ttleliege Choker of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:erserker's Scarf\n1:lack Byregotia Choker\n6:Pearl Choker\n6:Star Choker of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\nb:Scarf of Crafting\n7:weet Pea Necklace\n6:Willow Necklace of Aiming\np:Casting\nq:rafting\np:Fending\np:Healing\np:Slaying\n2:ue Byregotia Choker\n5:Sweet Pea Necklace\n1:oarskin Choker\n2:gatyr's Necklace of Aiming\nm:Casting\nm:Healing\n2:ne Necklace\n4:wicca Necklace of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:rass Choker\n6:Gorget\n2:onze Lone Wolf Choker\n7:Pack Wolf Choker\n1:ygone Brass Choker of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n0:Cait Sith Neck Ribbon\n2:mphorwood Necklace of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:rborundum Necklace of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n1:eremonial Necklace of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n1:hoker of Divine Death\nh:Wisdom\na:the Daring Duelist\nf:efiant Duelist\nf:ivine Harvest\nl:Light\nl:War\ne:Lost Thief\n1:itrine Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:laro Walnut Necklace of Gathering\n3:ssical Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:ollar of the Sea-folk\n2:pper Choker\n7:Gorget\n2:rgi Scarf\n2:urtly Lover's Choker of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n1:redendum Necklace of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n3:sted Necklace of Crafting\nk:Gathering\n2:uiser Gorget of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:yptlurker's Choker of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n3:starium Choker of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n0:Dai-ryumyaku Necklace of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n2:nburite Choker\n2:rbar Necklace of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n3:k Horse Champion's Choker of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\n5:Mahogany Necklace of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n4:light Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Maiming\nk:Striking\n2:ted Amethyst Choker\n7:quamarine Choker\n6:Brass Choker\n6:Copper Choker\n6:Danburite Choker\n6:Electrum Choker\n6:Fluorite Choker\n6:Garnet Choker\n7:oshenite Choker\n6:Heliodor Choker\n6:Lapis Lazuli Choker\n6:Malachite Choker\n7:ythril Choker\n6:Peridot Choker\n6:Silver Choker\n7:phene Choker\n7:unstone Choker\n2:ystar Necklace\n1:eepmist Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n4:shadow Necklace of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:magogue Choker\n1:iadochos Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n3:mond Choker\n8:Lone Wolf Choker\n8:Necklace of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n8:Pack Wolf Choker\n3:spore Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:rewolf Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:stance Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:odore Choker\n1:ragonskin Choker\n3:vanian Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:eadwyrm Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:warven Mythril Choker\n0:Edencall Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n5:hoir Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n4:gate Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n5:race Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n4:mete Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n5:orn Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:lectrum Choker\n9:Gorget\n1:merald Choker\n2:pyrean Necklace\n1:naretos Necklace\n1:pochal Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:ternal Dark Necklace of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n2:heirys Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:venstar Necklace\n3:rsharp Choker\n1:xarchic Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:plorer's Choker\n0:Fabled Necklace of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:cet Choker of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n2:ng Necklace\n2:rlander Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:ux Commander Necklace\n1:ilibuster's Choker of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:recrest Choker\n1:lame Sergeant's Choker\n2:uorite Choker\n0:Garnet Choker\n2:zelleskin Choker\n1:enji Necklace of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n3:ta Necklace of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:host Barque Choker of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n1:inseng Necklace\n1:lass Pumpkin Choker\n2:oam Choker\n1:oatskin Choker\n2:ld Lone Wolf Choker\n5:Pack Wolf Choker\n2:mphotherium Necklace\n2:rdian Neckband of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:shenite Choker\n1:rand Champion's Neckband of Aiming\nt:Casting\nt:Fending\nt:Healing\nt:Slaying\n2:een Byregotia Choker\n6:Sweet Pea Necklace\n2:iffin Leather Choker\n2:yphonskin Choker\n1:yuki Leather Choker\n0:Hallowed Chestnut Necklace\n3:onic Auditor's Choker\n8:Exorcist's Choker\n8:Friar's Choker\n8:Inquisitor's Choker\n8:Priest's Choker\n2:ndking's Necklace\n4:master's Necklace\n4:saint's Necklace\n2:rd Leather Choker\n1:eavyweight Neckband of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:irloom Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:liodor Choker\n3:lwolf Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:matite Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:ro's Necklace of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:igh Allagan Choker of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:storia Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:oly Cedar Necklace\n2:plite Choker\n2:rn Necklace\n3:se Chestnut Necklace of Gathering\n0:Ihuykanite Choker of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:mmaculate Necklace of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:perial Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n9:Jade Necklace of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n9:Operative Choker\n1:ndagator's Necklace of Crafting\no:Gathering\n2:tegral Necklace of Crafting\n1:olite Choker\n1:ronwood Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n9:Necklace of Crafting\n6:rks Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\na:Necklace of Crafting\nm:Gathering\n1:shgardian Chaplain's Choker\nb:Historian's Choker\nb:Knight's Choker\nb:Monastic's Choker\nb:Outrider's Choker\n0:Koppranickel Necklace of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:tiseos Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:umbhiraskin Necklace of Gathering\n0:Lakeland Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n3:shmi's Necklace of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:ndking's Necklace\n4:master's Choker\n4:saint's Necklace\n2:pis Lazuli Choker\n2:r Choker\n3:ch Necklace\n1:eather Choker\n1:ight-heavy Choker of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n3:num Vitae Necklace\n2:mbo Necklace of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:oboskin Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:st Allagan Choker of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n1:unar Envoy's Necklace of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n0:Mage's Choker\n2:kai Choker of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n2:lachite Choker\n2:meshiba Neckerchief\n2:nalis Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n4:silver Choker\n3:dragora Choker\n3:usya Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:rid Leather Choker\n1:idan Neckband of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:litia Choker\n2:rage Choker\n2:stbreak Necklace of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n4:fall Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n4:ic Memory Choker of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n4:wake Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:oonward Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:ythril Choker\n8:Gorget\n6:te Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n0:Nabaath Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:mazu Bell\n7:Neckerchief\n2:tural Afflatus Necklace\n1:ecklace of the First Light\n2:o Kingdom Choker of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n3:-Ishgardian Choker of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:oct Choker\n2:mad's Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n0:Occult Necklace of Blood\nj:Magic\n1:mega Choker of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n2:icron Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:pal Choker of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n2:hiotauroskin Necklace of Gathering\n1:range Byregotia Choker\n7:Sweet Pea Necklace\n2:igenics Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:thodox Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n0:Paglth'an Necklace of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:laka Choker of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n3:ladium Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:negyrist's Scarf\n2:ramour's Pendant\n2:triot's Choker\n1:each Blossom Choker\n3:rl Choker\n2:ltast Choker\n2:ridot Choker\n3:simmon Necklace\n2:talite Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:wter Choker of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:hantasmal Sardine Necklace\n2:rygian Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:icaroon's Necklace of Slaying\n1:lague Bringer's Choker\n7:Doctor's Choker\n3:tinum Lone Wolf Choker\n9:Pack Wolf Choker\nb:ramour's Pendant\n9:Scarf of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:raemagitek Necklace of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:imal Choker of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:ophet's Scarf\n3:to Ultima Necklace of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n5:type Alexandrian Neckband of Aiming\ny:Casting\ny:Fending\ny:Healing\ny:Slaying\na:Gordian Neckband of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\na:Midan Neckband of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\n1:urgatory Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n3:ple Byregotia Choker\n7:Sweet Pea Necklace\n0:Quetzalli Necklace of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n0:Radiant's Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:inbow Byregotia Choker\n8:Ribbon of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n8:Sweet Pea Necklace\n2:kshasa Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:mie Ribbon of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n2:ptorskin Choker\n2:vel Keeper's Choker of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:ed Byregotia Choker\n4:Coral Necklace\n4:Sweet Pea Necklace\n3:bill Scarf\n2:silient Choker of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:ibbon of Aiming\na:Casting\na:Fending\na:Healing\na:Slaying\n2:nascita Necklace of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:versbreath Necklace of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:onkan Necklace of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:se Gold Choker\na:Gorget\n2:yal Volunteer's Choker of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\n1:ubellite Choker\n3:y Choker\n5:Tide Necklace of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:yumyaku Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n0:Sapphire Choker\n1:caevan Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:erpent Sergeant's Choker\n1:hadowless Necklace of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n3:rlayan Conservator's Choker\nb:ustodian's Choker\na:Pankratiast's Choker\nb:hilosopher's Choker\nb:receptor's Choker\n2:ire Conservator's Choker\n7:ustodian's Choker\n6:Pankratiast's Choker\n7:hilosopher's Choker\n7:receptor's Choker\n1:ilver Choker\n7:Gorget\n7:Lone Wolf Choker\n7:Pack Wolf Choker\n1:kallic Necklace of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:ydeep Necklace of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:lothskin Necklace of Gathering\n1:milodonskin Choker\n1:phene Choker\n2:inel Choker\n1:tar Quartz Choker of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n5:Spinel Choker of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n5:Tech Choker of Crafting\nk:Gathering\n2:onewall Choker\n3:rm Sergeant's Choker\n2:rategos Choker\n1:unburst Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n3:stone Choker\n5:reak Necklace of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n0:Teak Choker of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n1:he Emperor's New Necklace\n4:Forgiven's Necklace of Aiming\nr:Casting\nr:Fending\nr:Healing\nr:Slaying\n4:Last Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n4:Twelve's Necklace of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:opaz Choker\n2:rreya Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:urmaline Choker\n2:xotes Choker\n1:riphane Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n4:lite Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:oian Choker of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:urquoise Choker\n0:Ultima Choker of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:nderkeep Neckband of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:olosapa Scarf\n0:Valerian Archer's Choker\n9:Brawler's Choker\n9:Dark Priest's Choker\n9:Fusilier's Choker\n9:Priest's Choker\n9:Shaman's Choker\na:muggler's Choker\n9:Terror Knight's Choker\n9:Wizard's Choker\n3:kyrie's Choker of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:nguard Neckband of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:rlet's Necklace\n1:iking Scarf\n1:oeburtite Necklace of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:idmoon Necklace of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n0:Warg Choker of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n3:wolf Choker of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:yfarer's Necklace\n1:eathered Auroral Choker\na:Choker\na:Daystar Necklace\na:Evenstar Necklace\na:Gloam Choker\na:Noct Choker\n2:rewolf Choker of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:halaqee Choker\n2:ite Ash Necklace\n6:Byregotia Choker\n6:Gold Choker of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n6:Oak Necklace\n6:Sweet Pea Necklace\n1:oad Skydruid's Choker\n8:hunter's Choker\n8:raider's Choker\n8:warrior's Choker\n9:icce's Choker\n2:lf Amber Choker\n5:Necklace\n5:Rubellite Choker\n5:Spinel Choker\n5:Tourmaline Choker\n6:urquoise Choker\n5:Zircon Choker\n1:rangler's Scarf\n1:yvernskin Choker\n0:Xenobian Paladin's Choker\n0:Yama Necklace of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:nxian Necklace of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:sha Necklace of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:ellow Byregotia Choker\n7:Sweet Pea Necklace\n1:uweyawata Necklace of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n0:Zelkova Necklace\n1:ircon Choker\n1:ormor Necklace of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying")),"wrists":new Set(decodeEcNativeNames("0:Abyssos Amulet of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:cacia Bracelet\n1:esthete's Bracelet of Gathering\nj:s of Crafting\n2:therial Amber Bracelet\nc:ethyst Bracelet\nb:quamarine Bracelet\na:Black Pearl Bracelet\nb:oarskin Wristbands\nc:ne Armillae\nb:rass Wristlets\na:Coral Armillae\na:Danburite Bracelet\na:Electrum Wristlets\na:Fluorite Bracelet\na:Garnet Bracelet\nb:oatskin Wristbands\nc:shenite Bracelet\na:Hard Leather Wristbands\nb:eliodor Bracelet\na:Lapis Lazuli Bracelet\na:Malachite Bracelet\nb:ythril Wristlets\na:Pearl Bracelet\nc:ridot Bracelet\na:Raptorskin Wristbands\nb:ed Coral Armillae\nb:ubellite Bracelet\na:Silver Wristlets\nb:phene Bracelet\nc:inel Bracelet\nb:unstone Bracelet\na:Tortoiseshell Armillae\nc:urmaline Bracelet\nb:urquoise Bracelet\na:Zircon Bracelet\n1:la Mhigan Bracelet of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:exandrian Bracelets of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n2:lagan Bracelets of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Maiming\nl:Striking\n3:iance Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:pha Wolf Bracelets\n1:maurotine Bracelets of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:ber Bracelet\n2:ethyst Bracelet\n4:rine Armillae of Crafting\n9:Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:nabaseios Bracelet of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n3:mnesis Bracelet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:quamarine Bracelet\n1:rcheo Kingdom Wristband of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\n2:dent Bracelet of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:hat Bracelets of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:tful Afflatus Bracelet\n1:scension Bracelet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:phodelos Amulet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:tral Birch Armillae\n8:racelet\n2:uran Bracelets of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:trociraptorskin Amulet of Aiming\nr:Casting\nr:Fending\nr:Healing\nr:Slaying\n1:ugmented Archeo Kingdom Wristband of Aiming\n12:Casting\n12:Fending\n12:Healing\n12:Slaying\na:Black Willow Armillae of Aiming\nz:Casting\nz:Fending\nz:Healing\nz:Slaying\nb:ygone Brass Bracelet of Aiming\nz:Casting\nz:Fending\nz:Healing\nz:Slaying\na:Ceremonial Bangle of Aiming\nv:Casting\nv:Fending\nv:Healing\nv:Slaying\nb:lassical Wristband of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\nb:ourtly Lover's Wristlet of Aiming\n12:Casting\n12:Fending\n12:Healing\n12:Slaying\nb:redendum Bracelets of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\nc:yptlurker's Bracelet of Aiming\n10:Casting\n10:Fending\n10:Healing\n10:Slaying\nd:starium Wristband of Aiming\ny:Casting\ny:Fending\ny:Healing\ny:Slaying\na:Deepshadow Bracelet of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\nb:iadochos Wristband of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\na:Exarchic Bracelet of Aiming\nv:Casting\nv:Fending\nv:Healing\nv:Slaying\na:Facet Bracelet of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\na:Handmaster's Armillae\nb:istoria Wristband of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\na:Ironworks Bracelet of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\na:Landmaster's Wristbands\nb:ost Allagan Bracelet of Aiming\nz:Casting\nz:Fending\nz:Healing\nz:Slaying\nb:unar Envoy's Bracelets of Aiming\n11:Casting\n11:Fending\n11:Healing\n11:Slaying\na:Neo-Ishgardian Wristbands of Aiming\n13:Casting\n13:Fending\n13:Healing\n13:Slaying\na:Primal Bracelet of Aiming\nt:Casting\nt:Fending\nt:Healing\nt:Slaying\na:Quetzalli Bracelets of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\na:Radiant's Bracelet of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\nb:inascita Bracelet of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\na:Scaevan Bracelet of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\nb:hire Conservator's Bracelet\nh:ustodian's Bracelet\ng:Pankratiast's Bracelets\nh:hilosopher's Bracelets\nh:receptor's Bracelets\n2:roral Wristlets\n3:um Regis Bracelet of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n1:zurite Bracelet of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n0:Babyface Champion's Bangle of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\n2:ngles of the First Light\n2:ttleliege Bracelet of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n1:erserker's Bangles\n1:ismuth Bracelet of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:lack Cornflower Wristlets\n6:Pearl Bracelet\n6:Star Bracelet of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\nj:s of Crafting\n6:Willow Armillae of Aiming\np:Casting\nq:rafting\np:Fending\np:Healing\np:Slaying\n2:ue Cornflower Wristlets\n5:Zircon Bracelet of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n1:oarskin Wristbands\nj: of Gathering\n2:gatyr's Armillae of Aiming\nm:Casting\nm:Healing\n2:ne Armillae\n4:wicca Bangle of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:racelet of Divine Death\nj:Wisdom\nc:the Daring Duelist\nh:efiant Duelist\nh:ivine Harvest\nn:Light\ng:Lost Thief\n8:s of the Divine War\nh:Sea-folk\n3:ss Wristlets\nf: of Crafting\n2:onze Lone Wolf Bracelets\n7:Pack Wolf Bracelets\n1:ygone Brass Bracelet of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n0:Camphorwood Armillae of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:rborundum Bracelet of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n1:eremonial Bangle of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:hrysolite Bracelet of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n1:laro Walnut Bracelet of Gathering\n3:ssical Wristband of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n1:opper Wristlets\n2:ral Armillae\n2:urtly Lover's Wristlet of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\n1:redendum Bracelets of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n3:sted Bracelet of Crafting\nk:Gathering\n2:imson Standard Bracelet\n2:uiser Bangle of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:yptlurker's Bracelet of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n3:starium Wristband of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n0:Dai-ryumyaku Bracelet of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n2:nburite Bracelet\n2:rbar Bracelet of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n3:k Horse Champion's Bangle of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\n4:light Bracelet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Maiming\nm:Striking\n2:ted Black Pearl Bracelet\n8:ue Coral Wristbands\nr: (Black)\nt:Yellow)\n7:one Armillae\n7:rass Wristlets\n6:Copper Wristlets\n6:Danburite Bracelet\n8:rksilver Wristlet\n6:Electrum Wristlets\n6:Fluorite Bracelet\n6:Lapis Lazuli Bracelet\n6:Malachite Bracelet\n7:ythril Wristlets\n6:Pearl Bracelet\n6:Red Coral Wristbands\nq: (Black)\ns:Yellow)\n6:Silver Wristlets\n7:phene Bracelet\n7:unstone Bracelet\n6:White Coral Wristbands\ns: (Black)\nu:Yellow)\n2:wn Wristguards\n2:ystar Armillae\n1:eepmist Armillae of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n4:shadow Bracelet of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:magogue Wristlets\n1:iadochos Wristband of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n3:mond Bracelet\ng: of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n8:Lone Wolf Bracelets\n8:Pack Wolf Bracelets\n3:spore Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:rewolf Armillae of Fending\n9:Wristbands of Aiming\nn:Casting\nn:Healing\nn:Slaying\n2:stance Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:ragonskin Wristbands\n3:vanian Bracelet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:eadwyrm Bracelet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:warven Mythril Bracelets\n0:Edencall Wristband of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n5:hoir Wristband of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n4:gate Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n5:race Bracelet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n4:mete Wristlet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n5:orn Wristlet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:lectrum Wristlets\ni: of Crafting\n1:merald Bracelet\n2:pyrean Bracelet\n1:naretos Bracelet\n1:pochal Bracelet of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:ternal Dark Bracelets of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n2:heirys Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:venstar Armillae\n3:rsharp Wristbands\n1:xarchic Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n0:Fabled Bracelet of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:cet Bracelet of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:rlander Bangle of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:ilibuster's Bracelet of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n2:recrest Bracelet\n1:lame Sergeant's Bracelet\n2:uorite Bracelet\n0:Garnet Bracelet\n2:zelleskin Wristband\n1:enji Bracelet of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n3:ta Bracelet of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:host Barque Bracelet of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:inseng Bracelet\n1:lass Pumpkin Bracelet\n2:oam Wristlets\n1:oatskin Wristbands\nj: of Gathering\n2:ld Lone Wolf Bracelets\n5:Pack Wolf Bracelets\n2:mphotherium Wristband\n2:rdian Wristband of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:shenite Bracelet\n1:rand Champion's Bracelets of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\n2:een Cornflower Wristlets\n2:iffin Leather Wristbands\n2:yphonskin Wristbands\n1:yuki Leather Wristband\n0:Hallowed Chestnut Armillae\n3:onic Auditor's Bracelets\n8:Exorcist's Bracelets\n8:Friar's Bracelets\n8:Inquisitor's Bracelets\n8:Priest's Bracelets\n2:ndking's Armillae\n4:master's Armillae\n4:saint's Bracelets\n2:rd Leather Wristbands\nn: of Gathering\n4:silver Bangle of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:eavyweight Bracelets of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n2:irloom Amulet of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:liodor Bracelet\n3:lwolf Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:ro's Bracelet of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:igh Allagan Bracelets of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n2:storia Wristband of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:oly Cedar Armillae\n2:plite Wristlets\n2:rn Armillae\n3:se Chestnut Bracelet of Gathering\n0:Ihuykanite Bracelet of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n1:mmaculate Bracelets of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:perial Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n9:Jade Armillae of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n9:Operative Wristlets\n1:ndagator's Bracelet of Crafting\no:Gathering\n2:ferno Bangle of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:tegral Bracelet of Crafting\n1:olite Bracelet\n1:ronwood Bracelet of Crafting\n6:rks Armillae of Crafting\nm:Gathering\na:Bracelet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:shgardian Chaplain's Bracelets\nb:Historian's Bracelets\nb:Knight's Bracelets\nb:Monastic's Bracelets\nb:Outrider's Bracelets\n2:lewolf Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n0:Koppranickel Bracelet of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:tiseos Bracelet of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:umbhiraskin Armilla of Gathering\n0:Lakeland Amulet of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n3:shmi's Bracelet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:ndking's Armillae\n4:master's Wristbands\n4:saint's Bracelets\n2:pis Lazuli Bracelet\n2:r Bracelets\n3:ch Bracelets\n1:eather Wristbands\n1:ight-heavy Bangle of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n3:num Vitae Bracelet\n2:ly and Serpent Bracelet\n2:mbo Amulet of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n1:oboskin Amulet of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:st Allagan Bracelet of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:unar Envoy's Bracelets of Aiming\nr:Casting\nr:Fending\nr:Healing\nr:Slaying\n0:Makai Bracelet of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:lachite Bracelet\n2:nalis Wristband of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n4:silver Bracelets\n3:usya Amulet of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:rid Leather Wristband\n1:idan Bracelets of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:litia Bracelets\n8:Wristlets\n2:rage Bracelet\n2:stbreak Armillae of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n4:fall Armillae of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n4:ic Memory Bracelet of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n4:wake Amulet of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:oonward Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:ythril Wristlets\nh: of Crafting\n6:te Bangle of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\na:racelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n0:Nabaath Wristband of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:tural Afflatus Wristband\n1:eo Kingdom Bangles of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n3:-Ishgardian Wristbands of Aiming\nt:Casting\nt:Fending\nt:Healing\nt:Slaying\n1:oct Wristlets\n2:mad's Wristbands of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n0:Occult Bracelet of Blood\nj:Magic\n1:mega Bracelet of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:icron Bracelet of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:pal Bracelet of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:hiotauroskin Wristband of Gathering\n1:range Cornflower Wristlets\n2:igenics Wristlet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:thodox Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n0:Paglth'an Armillae of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:laka Bracelet of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n3:ladium Bracelet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n3:m Bracelets of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:negyrist's Bangles\n2:triot's Bracelet\n1:earl Bracelet\n2:ltast Wristlets\n2:ridot Bracelet\n3:simmon Bracelets\n2:talite Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:hantasmal Sardine Bracelet\n1:icaroon's Armillae of Slaying\n2:nk Beryl Bracelet of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n1:lague Bringer's Bracelet\n7:Doctor's Bracelet\n3:tinum Bangles of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n9:Lone Wolf Bracelets\n9:Pack Wolf Bracelets\n1:raemagitek Bracelet of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:imal Bracelet of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:omise of Devotion\nj: (Platinum)\nb:Innocence\nk: (Standard)\nb:Passion\ni: (Gold)\n3:phet's Bangles\n3:to Ultima Amulet of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n5:type Alexandrian Bracelets of Aiming\nz:Casting\nz:Fending\nz:Healing\nz:Slaying\na:Gordian Wristband of Aiming\nv:Casting\nv:Fending\nv:Healing\nv:Slaying\na:Midan Bracelets of Aiming\nt:Casting\nt:Fending\nt:Healing\nt:Slaying\n1:urgatory Amulet of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n3:ple Cornflower Wristlets\n0:Quetzalli Bracelets of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n0:Radiant's Bracelet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:inbow Cornflower Wristlets\n2:kshasa Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:ptorskin Wristbands\nl: of Gathering\n2:vel Keeper's Bracelet of Aiming\nr:Casting\nr:Fending\nr:Healing\nr:Slaying\n1:ed Coral Armillae\n7:nflower Wristlets\n2:silient Bracelet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n1:inascita Bracelet of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:versbreath Bracelet of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:onkan Bracelets of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:se Gold Bracelets\n2:yal Volunteer's Bracelet of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\n1:ubellite Bracelet\n3:y Bracelet\n5:Tide Bracelets of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n1:yumyaku Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n0:Sapphire Bracelet\n1:caevan Bracelet of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:erpent Sergeant's Bracelet\n1:hadowless Bracelet of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n3:rlayan Conservator's Bangle\nb:ustodian's Bangle\na:Pankratiast's Bangle\nb:hilosopher's Bangle\nb:receptor's Bangle\n2:ire Conservator's Bracelet\n7:ustodian's Bracelet\n6:Pankratiast's Bracelets\n7:hilosopher's Bracelets\n7:receptor's Bracelets\n1:ilver Lone Wolf Bracelets\n7:Pack Wolf Bracelets\n7:Wristlets\ng: of Crafting\n1:kallic Amulet of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:ydeep Bracelets of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:lothskin Armillae of Gathering\n1:milodonskin Wristband\n1:phene Bracelet\n2:inel Bracelet\n1:tar Quartz Wristband of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n5:Spinel Bracelet of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n5:Tech Bracelet of Crafting\nm:Gathering\n2:orm Sergeant's Bracelet\n2:rategos Wristlets\n1:unburst Armillae of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n3:stone Bracelet\n5:reak Armillae of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n0:Teak Bracelet of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:he Emperor's New Bracelet\n4:Forgiven's Bracelet of Aiming\nr:Casting\nr:Fending\nr:Healing\nr:Slaying\n4:Last Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n4:Twelve's Bracelet of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n1:ipping Scales Bracelet\n1:opaz Bracelet\n2:rreya Bracelet of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n3:toiseshell Armillae\n2:urmaline Bracelet\n2:xotes Wristlets\n1:riphane Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n4:lite Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:oian Bracelet of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:ue Ice Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:urquoise Bracelet\n0:Underkeep Wristband of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n0:Valerian Archer's Bracelet\n9:Brawler's Bracelet\n9:Dark Priest's Bracelet\n9:Fusilier's Bracelet\n9:Priest's Bracelet\n9:Shaman's Bracelet\na:muggler's Bracelet\n9:Terror Knight's Bracelet\n9:Wizard's Bracelet\n3:kyrie's Bracelet of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:nguard Bracelets of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:rlet's Armillae\n1:iking Bangles\n1:oeburtite Armillae of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n2:idmoon Bracelets of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n0:Warg Bracelet of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n3:wolf Bracelet of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:eathered Auroral Wristlets\na:Daystar Armillae\na:Evenstar Armillae\na:Gloam Wristlets\na:Noct Wristlets\na:Wristlets\n2:rewolf Bracelet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:halaqee Bracelet\n2:ite Ash Bracelet\n6:Cornflower Wristlets\n6:Gold Amulet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n6:Oak Bracelets\n1:oad Skydruid's Bangle\n8:hunter's Bangle\n8:raider's Bangle\n8:warrior's Bangle\n9:icce's Bangle\n2:lf Amber Bracelet\n5:Rubellite Bracelet\n5:Spinel Bracelet\n5:Tourmaline Bracelet\n6:urquoise Bracelet\n5:Zircon Bracelet\n1:rangler's Bangles\n1:yvernskin Wristbands\n0:Xenobian Paladin's Bracelet\n0:Yama Bracelet of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:nxian Bracelets of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:sha Bracelets of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:ellow Cornflower Wristlets\n1:o-kai Watch\n1:uweyawata Amulet of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n0:Zelkova Bracelets\n1:ircon Bracelet\n1:ormor Bracelet of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying")),"rings":new Set(decodeEcNativeNames("0:Abyssos Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n1:cacia Ring\n1:esthete's Ring of Crafting\nj:Gathering\n2:therial Amber Ring\nc:ethyst Ring\nb:quamarine Ring\na:Black Pearl Ring\nb:rass Ring\na:Coral Ring\na:Danburite Ring\na:Electrum Ring\na:Fluorite Ring\na:Garnet Ring\nb:oshenite Ring\na:Heliodor Ring\nb:orn Ring\na:Lapis Lazuli Ring\na:Malachite Ring\nb:ythril Ring\na:Pearl Ring\nc:ridot Ring\na:Red Coral Ring\nb:ubellite Ring\na:Silver Ring\nb:phene Ring\nc:inel Ring\nb:unstone Ring\na:Tourmaline Ring\nb:urquoise Ring\na:Zircon Ring\n6:yte Ring\n1:gate Ring of Aiming\ne:Casting\ne:Fending\ne:Healing\ne:Slaying\n1:la Mhigan Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:exandrian Ring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:lagan Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Maiming\ng:Striking\n3:iance Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:pha Wolf Ring\n2:thyk's Ring\n1:maurotine Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:ber Ring\n2:ethyst Ring\n4:rine Ring of Aiming\nh:Casting\ni:rafting\nh:Fending\nh:Healing\nh:Slaying\n1:nabaseios Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n3:mnesis Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:quamarine Ring\n1:rcanist's Ring\n3:heo Kingdom Ring of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n5:r's Ring\n2:dent Ring of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n2:hat Ring of Aiming\ne:Casting\ne:Fending\ne:Healing\ne:Slaying\n2:tful Afflatus Ring\n1:scension Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:phodelos Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:tral Birch Ring\n7:Ring\n2:uran Ring of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n1:ugmented Archeo Kingdom Ring of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\na:Bygone Brass Ring of Aiming\nv:Casting\nv:Fending\nv:Healing\nv:Slaying\na:Ceremonial Ring of Aiming\nt:Casting\nt:Fending\nt:Healing\nt:Slaying\nb:lassical Ring of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\nb:ourtly Lover's Ring of Aiming\ny:Casting\ny:Fending\ny:Healing\ny:Slaying\nb:redendum Ring of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\nc:yptlurker's Ring of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\nd:starium Ring of Aiming\nt:Casting\nt:Fending\nt:Healing\nt:Slaying\na:Deepshadow Ring of Aiming\nt:Casting\nt:Fending\nt:Healing\nt:Slaying\nb:iadochos Ring of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\na:Exarchic Ring of Aiming\nr:Casting\nr:Fending\nr:Healing\nr:Slaying\na:Facet Ring of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\na:Handmaster's Ring\nb:istoria Ring of Aiming\nr:Casting\nr:Fending\nr:Healing\nr:Slaying\na:Ironworks Ring of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\na:Landmaster's Ring\nb:ost Allagan Ring of Aiming\nv:Casting\nv:Fending\nv:Healing\nv:Slaying\nb:unar Envoy's Ring of Aiming\nw:Casting\nw:Fending\nw:Healing\nw:Slaying\na:Neo-Ishgardian Ring of Aiming\nx:Casting\nx:Fending\nx:Healing\nx:Slaying\na:Primal Ring of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\na:Quetzalli Ring of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\na:Radiant's Ring of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\nb:inascita Ring of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\na:Scaevan Ring of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\nb:hire Conservator's Ring\nh:ustodian's Ring\ng:Pankratiast's Ring\nh:hilosopher's Ring\nh:receptor's Ring\nb:ilvergrace Ring of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\n2:roral Ring\n1:zeyma's Ring\n2:urite Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n0:Babyface Champion's Ring of Aiming\ns:Casting\ns:Fending\ns:Healing\ns:Slaying\n2:ttleliege Ring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:erserker's Ring\n1:ismuth Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n1:lack Pearl Ring\n6:Star Ring of Aiming\nj:Casting\nk:rafting\nj:Fending\nj:Healing\nj:Slaying\n6:Willow Ring of Crafting\n2:essed Ring\n2:itzring\n2:ue Zircon Ring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:oarskin Ring\n2:gatyr's Ring of Aiming\ni:Casting\ni:Healing\n2:ne Ring\n4:wicca Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:rand-new Ring\n3:ss Ring\na: of Crafting\n2:illiant Egg Ring\n2:onze Lone Wolf Ring\n7:Pack Wolf Ring\n1:ygone Brass Ring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:regot's Ring\n0:Carborundum Ring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:eremonial Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:hocobo Egg Ring\n2:rysolite Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:lassical Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:onjurer's Ring\n2:pper Ring\n2:ral Ring\n2:urtly Lover's Ring of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n1:redendum Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n3:sted Ring of Crafting\ng:Gathering\n2:imson Standard Ring\n2:uiser Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n2:yptlurker's Ring of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n3:starium Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n0:Dai-ryumyaku Ring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:nburite Ring\n2:rbar Ring of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n3:k Horse Champion's Ring of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\n4:light Band of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Maiming\ni:Striking\n2:ted Amethyst Ring\n7:quamarine Ring\n6:Black Pearl Ring\n7:one Ring\n7:rass Ring\n6:Copper Ring\n6:Danburite Ring\n8:rksilver Ring\n6:Electrum Ring\n6:Fluorite Ring\n6:Garnet Ring\n7:oshenite Ring\n6:Heliodor Ring\n6:Lapis Lazuli Ring\n6:Malachite Ring\n6:Pearl Ring\n8:ridot Ring\n6:Silver Ring\n7:phene Ring\n7:unstone Ring\n2:ystar Ring\n1:eepmist Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n4:shadow Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:magogue Ring\n1:iadochos Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n3:mond Lone Wolf Ring\n8:Pack Wolf Ring\n8:Ring\nc: of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n3:spore Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:rewolf Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:stance Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:odore Ring\n1:ragonskin Ring\n3:vanian Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:eadwyrm Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:warven Mythril Ring\n0:Edencall Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n5:hoir Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n4:gate Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n5:race Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n4:mete Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n5:orn Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:ikon Iron Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:lectrum Ring\nd: of Crafting\n1:merald Ring\n2:pyrean Ring\n1:naretos Ring\n1:pochal Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n1:ternal Dark Ring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n5:ity Ring\n2:heirys Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:venstar Ring\n3:rsharp Ring\n1:xarchic Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:plorer's Ring\n0:Fabled Ring of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n2:cet Ring of Aiming\ne:Casting\ne:Fending\ne:Healing\ne:Slaying\n2:rlander Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:ilibuster's Ring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:recrest Ring\n1:lame Private's Ring\n6:Sergeant's Ring\n5:bringer's Ring\n5:carrier's Ring\n2:uorite Ring\n0:Garnet Ring\n2:zelleskin Ring\n1:enji Ring of Aiming\ne:Casting\ne:Fending\ne:Healing\ne:Slaying\n3:ta Ring of Aiming\ne:Casting\ne:Fending\ne:Healing\ne:Slaying\n1:host Barque Ring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:inseng Ring\n1:ladiator's Ring\n3:ss Pumpkin Ring\n2:oam Ring\n1:oatskin Ring\n2:ld Lone Wolf Ring\n5:Pack Wolf Ring\n2:mphotherium Ring\n2:rdian Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n2:shenite Ring\n1:rand Champion's Ring of Aiming\np:Casting\np:Fending\np:Healing\np:Slaying\n2:eat Serpent of Ringa\n2:idanian Ring\n3:ffin Leather Ring\n8:Talon Ring of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n2:yphonskin Ring\n1:ysahl Ring\n2:uki Leather Ring\n0:Hallowed Chestnut Ring\n3:one's Ring\n5:ic Auditor's Ring\n8:Exorcist's Ring\n8:Friar's Ring\n8:Inquisitor's Ring\n8:Priest's Ring\n2:ndking's Ring\n4:master's Ring\n4:saint's Ring\n1:eavyweight Ring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:irloom Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:liodor Ring\n3:lwolf Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:ro's Ring of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n1:igh Allagan Ring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n2:storia Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:oly Cedar Ring\n2:plite Ring\n2:rn Ring\n3:se Chestnut Ring of Gathering\n0:Ihuykanite Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:mmaculate Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:perial Jade Ring of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n9:Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:ndagator's Ring of Crafting\nk:Gathering\n2:tegral Ring of Crafting\n1:olite Ring\n1:ronwood Ring of Crafting\n6:rks Ring of Aiming\ni:Casting\nj:rafting\ni:Fending\ni:Gathering\ni:Healing\ni:Slaying\n1:shgardian Chaplain's Ring\nb:Historian's Ring\nb:Knight's Ring\nb:Monastic's Ring\nb:Outrider's Ring\n2:lewolf Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n0:Judgment Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n0:Ktiseos Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n1:umbhiraskin Ring of Gathering\n0:Lakeland Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n3:shmi's Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:ncer's Ring\n3:dking's Ring\n4:master's Ring\n4:saint's Ring\n2:pis Lazuli Ring\n2:r Ring\n8: of Aiming\nc:Casting\nc:Fending\nc:Healing\nc:Slaying\n3:ch Ring\n2:zurite Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:ight-heavy Ring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n3:num Vitae Ring\n2:ly and Serpent Ring\n2:mbo Ring of Aiming\ne:Casting\ne:Fending\ne:Healing\ne:Slaying\n1:lymlaen's Ring\n1:ominsan Ring\n2:st Allagan Ring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:unar Envoy's Ring of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n0:Mad Bird Ring\n2:ge's Ring\n2:kai Ring of Aiming\ne:Casting\ne:Fending\ne:Healing\ne:Slaying\n2:lachite Ring\n2:nalis Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n4:silver Ring\n3:usya Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n2:rauder's Ring\n3:id Leather Ring\n2:ster Alchemist's Ring\n8:rcanist's Ring\na:her's Ring\n9:morer's Ring\n7:Blacksmith's Ring\n8:otanist's Ring\n7:Carpenter's Ring\n8:onjurer's Ring\n8:ulinarian's Ring\n7:Fisher's Ring\n7:Gladiator's Ring\n8:oldsmith's Ring\n7:Lancer's Ring\n8:eatherworker's Ring\n7:Marauder's Ring\n8:iner's Ring\n7:Pugilist's Ring\n7:Rogue's Ring\n7:Thaumaturge's Ring\n7:Weaver's Ring\n1:enphina's Ring\n2:teor Survivor Ring\n1:idan Ring of Aiming\ne:Casting\ne:Fending\ne:Healing\ne:Slaying\n3:night Egg Ring\n2:rage Ring\n2:stbreak Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n4:fall Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n4:ic Memory Ring of Aiming\nm:Casting\nm:Fending\nm:Healing\nm:Slaying\n4:wake Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:oonward Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:rmorion Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:uudhorn Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:ythril Ring\nc: of Crafting\n0:Nabaath Leather Ring of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n2:ld'thal's Ring\n2:tural Afflatus Ring\n1:eo Kingdom Ring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n3:-Ishgardian Ring of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n3:phyte's Ring\n1:oct Ring\n2:mad's Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n2:phica's Ring\n1:ymeia's Ring\n0:Occult Ring of Blood\nf:Deep Blood\nk:Magic\nf:Magic\n1:mega Ring of Aiming\ne:Casting\ne:Fending\ne:Healing\ne:Slaying\n2:icron Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n1:pal Ring of Aiming\nd:Casting\nd:Fending\nd:Healing\nd:Slaying\n2:hiotauroskin Ring of Gathering\n1:rigenics Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:thodox Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:schon's Ring\n0:Paglth'an Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:issa Ring\n2:laka Ring of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n3:ladium Band of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\na:Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:negyrist's Ring\n1:earl Ring\n2:ltast Ring\n2:ridot Ring\n3:simmon Ring\n2:talite Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:wter Ring of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n1:hantasmal Sardine Ring\n1:icaroon's Ring of Slaying\n2:nk Beryl Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n1:lague Bringer's Ring\n7:Doctor's Ring\n3:tinum Lone Wolf Ring\n9:Pack Wolf Ring\n9:Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:raemagitek Ring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n2:imal Ring of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n3:stine Egg Ring\n2:ophet's Ring\n3:to Ultima Ring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n5:type Alexandrian Ring of Aiming\nu:Casting\nu:Fending\nu:Healing\nu:Slaying\na:Gordian Ring of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\na:Midan Ring of Aiming\no:Casting\no:Fending\no:Healing\no:Slaying\n1:ugilist's Ring\n2:rgatory Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n0:Quetzalli Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n0:Ra'Kaznar Ring of Gathering\n2:diant's Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n2:kshasa Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:ptorskin Ring\n2:vel Keeper's Ring of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n1:ed Coral Ring\n2:silient Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:halgr's Ring\n1:inascita Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n3:g of Divine Death\nf:Wisdom\n8:Fidelity\n9:ortitude\nc:une\n9:reedom\n8:Lasting Shelter\n8:the Daring Duelist\nd:efiant Duelist\nd:ivine Harvest\nj:Light\nj:War\nc:First Light\nc:Lost Thief\nc:Sea-folk\n2:versbreath Ring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:ogue's Ring\n2:nkan Ring of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n2:se Gold Ring\n2:yal Volunteer's Ring of Aiming\nq:Casting\nq:Fending\nq:Healing\nq:Slaying\n1:ubellite Ring\n3:y Ring\n5:Tide Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:yumyaku Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n0:Sapphire Ring\n1:caevan Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n2:intillant Ring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:erpent Private's Ring\n8:Sergeant's Ring\n7:bringer's Ring\n7:carrier's Ring\n1:hadowless Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n3:rlayan Conservator's Ring\nb:ustodian's Ring\na:Pankratiast's Ring\nb:hilosopher's Ring\nb:receptor's Ring\n2:ire Conservator's Ring\n7:ustodian's Ring\n6:Pankratiast's Ring\n7:hilosopher's Ring\n7:receptor's Ring\n1:ilver Lone Wolf Ring\n7:Pack Wolf Ring\n7:Ring\nb: of Crafting\n6:grace Ring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n1:kallic Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n2:ydeep Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n1:lothskin Ring of Gathering\n1:milodonskin Ring\n1:phene Ring\n2:inel Ring\n1:tar Quartz Ring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n5:Spinel Ring of Aiming\nk:Casting\nk:Fending\nk:Healing\nk:Slaying\n5:Tech Ring of Crafting\ni:Gathering\n2:onewall Ring\n3:rm Private's Ring\n6:Sergeant's Ring\n5:bringer's Ring\n5:carrier's Ring\n2:rategos Ring\n1:unburst Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n3:stone Ring\n5:reak Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n0:Thaliak's Ring\n3:umaturge's Ring\n2:e Emperor's New Ring\n4:Forgiven's Ring of Aiming\nn:Casting\nn:Fending\nn:Healing\nn:Slaying\n4:Last Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n4:Twelve's Ring of Aiming\nl:Casting\nl:Fending\nl:Healing\nl:Slaying\n1:ipping Scales Ring\n1:oadskin Ring\n2:paz Ring\n2:urmaline Ring\n2:xotes Ring\n1:riphane Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n4:lite Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:oian Ring of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n1:urquoise Ring\n0:Ul'dahn Ring\n2:tima Band of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n1:nderkeep Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n0:Valerian Archer's Ring\n9:Brawler's Ring\n9:Dark Priest's Ring\n9:Fusilier's Ring\n9:Priest's Ring\n9:Shaman's Ring\na:muggler's Ring\n9:Terror Knight's Ring\n9:Wizard's Ring\n3:kyrie's Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:nguard Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:rlet's Ring\n1:ibrant Egg Ring\n2:king Ring\n1:oeburtite Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n2:idmoon Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n2:rtex Ring of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying\n0:Warg Ring of Aiming\nd:Casting\nd:Fending\nd:Healing\nd:Slaying\n3:wolf Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n1:eathered Auroral Ring\na:Daystar Ring\na:Evenstar Ring\na:Gloam Ring\na:Noct Ring\na:Ring\n2:rewolf Ring of Aiming\nh:Casting\nh:Fending\nh:Healing\nh:Slaying\n1:halaqee Ring\n2:ite Ash Ring\n6:Gold Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n6:Oak Ring\n1:oad Skydruid's Ring\n8:hunter's Ring\n8:raider's Ring\n8:warrior's Ring\n9:icce's Ring\n2:lf Amber Ring\n5:Rubellite Ring\n5:Spinel Ring\n5:Tourmaline Ring\n6:urquoise Ring\n5:Zircon Ring\n1:rangler's Ring\n1:yvernskin Ring\n0:Xenobian Paladin's Ring\n0:Yama Ring of Aiming\nd:Casting\nd:Fending\nd:Healing\nd:Slaying\n2:nxian Ring of Aiming\ng:Casting\ng:Fending\ng:Healing\ng:Slaying\n2:sha Ring of Aiming\ne:Casting\ne:Fending\ne:Healing\ne:Slaying\n1:eti Fang Ring of Aiming\ni:Casting\ni:Fending\ni:Healing\ni:Slaying\n1:uweyawata Ring of Aiming\nj:Casting\nj:Fending\nj:Healing\nj:Slaying\n0:Zelkova Ring\n1:ircon Ring\n1:ormor Ring of Aiming\nf:Casting\nf:Fending\nf:Healing\nf:Slaying"))});
// END GENERATED EC SEARCH CATEGORIES

// /accessories has an unscoped text search in addition to four slot selects.
// The union must still contain only official accessory EquipSlotCategory rows.
const EC_ALL_ACCESSORY_NATIVES = new Set(
  Object.values(EC_ACCESSORY_SLOT_NATIVES).flatMap(slotNames => [...slotNames])
);


const SEARCH_EXCLUDE_RE = /author|player|title|comment|tag|username|email|password|作者|标题|标签|用户/i;
const SEARCH_INPUT_TYPES = new Set(['', 'text', 'search']);
const _searchInputCache = new WeakMap();

function normalizeSearchQuery(value) {
  return String(value ?? '').trim().replace(/[ \t\u00a0]+/g, ' ');
}

// 只有装备库列表页的查询可以按“套装系列 + 职能”映射。其它 EC 页面
// （如 /glamours、装备部位 vue-select）继续使用单件装备索引。
function isECGearsetsPage() {
  const loc = globalThis.location;
  // 除 /gearsets 外，职业子目录（如 /gearsets/casters）同样是可检索的套装列表。
  return /^\/gearsets(?:\/[a-z-]+)?\/?$/i.test(loc?.pathname || '')
    && /(^|\.)eorzeacollection\.com$/i.test(loc?.hostname || '');
}

function ecSlotFromHint(hint) {
  const patterns = [
    /\b(?:head|headpiece|headwear|headgear|helmet)\b|头部|头饰|头盔/iu,
    /\b(?:body|bodypiece|chest|chestpiece)\b|身体|躯干|上衣/iu,
    /\b(?:hands?|handpiece|gloves?)\b|手部|手套/iu,
    /\b(?:legs?|legpiece|pants|trousers)\b|腿部|裤子/iu,
    /\b(?:feet|foot|footpiece|boots?|shoes?)\b|脚部|足部|靴子/iu,
  ];
  const matches = patterns.flatMap((pattern, index) => pattern.test(hint) ? [index] : []);
  return matches.length === 1 ? matches[0] : null;
}

// Accessory selectors share the same EC Vue input component but use four
// distinct official EquipSlotCategory IDs, not the five armor slot groups.
function ecAccessorySlotFromHint(hint) {
  const patterns = [
    ['ears', /\b(?:ears?|earrings?|earpieces?)\b|耳饰|耳环|耳部/iu],
    ['neck', /\b(?:necks?|necklaces?|neckpieces?|chokers?)\b|项链|项圈|颈部/iu],
    ['wrists', /\b(?:wrists?|bracelets?|bangles?|wristpieces?)\b|腕部|手镯|腕饰/iu],
    ['rings', /\b(?:rings?|fingers?|fingerpieces?)\b|戒指|指环|手指/iu],
  ];
  const matches = patterns.filter(([, pattern]) => pattern.test(hint));
  return matches.length === 1 ? matches[0][0] : null;
}

function ecSlotFromInput(input, resolveHint = ecSlotFromHint) {
  const hint = [
    input?.getAttribute?.('placeholder'),
    input?.getAttribute?.('aria-label'),
    input?.getAttribute?.('data-slot'),
    input?.getAttribute?.('name'),
    input?.closest?.('[data-slot]')?.getAttribute?.('data-slot'),
  ].filter(Boolean).join(' ');
  const explicit = resolveHint(hint);
  if (explicit !== null) return explicit;
  // EC occasionally supplies only a generic placeholder. Read the nearest
  // compact field label, never a full form containing multiple slot names.
  let node = input?.parentElement;
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    const label = String(node.textContent || '').trim();
    if (label.length > 0 && label.length < 50) {
      const slot = resolveHint(label);
      if (slot !== null) return slot;
    }
  }
  return null;
}

// EC intelligent inputs are scoped by page purpose or explicit equipment slot.
// The specialty lists come from official ItemAction and Glasses game data.
function ecSearchContext(input) {
  const loc = globalThis.location;
  if (!/(^|\.)eorzeacollection\.com$/i.test(loc?.hostname || '')) return null;
  const path = loc?.pathname || '';
  if (/^\/companion-glamours(?:\/|$)/i.test(path)) return { kind: 'barding' };
  if (/^\/facewear(?:\/|$)/i.test(path)) return { kind: 'facewear' };
  // Gearsets free-text search is intentionally separate from equipment filtering.
  // The /accessories catalogue also has free-text inputs without a slot label:
  // those must use the union of official jewelry slots, never all gear.
  const accessoryPage = /^\/accessories(?:\/|$)/i.test(path);
  if (!/\bvs__search\b/.test(String(input?.className || ''))) {
    return accessoryPage ? { kind: 'accessories' } : null;
  }
  const slot = ecSlotFromInput(input);
  if (slot !== null) return { kind: 'slot', slot };
  const accessory = ecSlotFromInput(input, ecAccessorySlotFromHint);
  if (accessory !== null) return { kind: 'accessory-slot', slot: accessory };
  return accessoryPage ? { kind: 'accessories' } : null;
}

function ecScopedSuggestions(query, input) {
  const context = ecSearchContext(input);
  if (context?.kind === 'facewear') return EC_FACEWEAR_ROWS.filter(row => row.zh.includes(query));
  if (context?.kind === 'barding') return suggestByZh(query, 0, EC_BARDING_NATIVES);
  if (context?.kind === 'slot') return suggestByZh(query, 0, context.slot);
  if (context?.kind === 'accessory-slot') {
    return suggestByZh(query, 0, EC_ACCESSORY_SLOT_NATIVES[context.slot]);
  }
  if (context?.kind === 'accessories') return suggestByZh(query, 0, EC_ALL_ACCESSORY_NATIVES);
  return isECGearsetsPage() && !/\bvs__search\b/.test(String(input?.className || ''))
    ? suggestECGearsetsByZh(query) : suggestByZh(query);
}

// Only an exact or a single unambiguous in-category name can be converted
// without choosing the explicit suggestion.
function ecScopedNative(query, input, allowPartial) {
  const rows = ecScopedSuggestions(query, input);
  const exact = rows.filter(row => row.zh === query);
  if (exact.length === 1) return exact[0].native;
  return allowPartial && rows.length === 1 ? rows[0].native : null;
}

function resolveSearchNative(query, gearsets = false) {
  if (gearsets) {
    const gearset = resolveECGearsetSearch(query);
    if (gearset) return gearset;
    // 多个套装命中却没有安全的英文公共词时，交给候选列表选择；
    // 不能回退到无关的单件物品索引，随意改写用户的套装查询。
    if (suggestECGearsetsByZh(query).length > 0) return null;
  }
  return resolveByZh(query) || resolvePartialByZh(query);
}

function isChineseSearchQuery(value) {
  const q = normalizeSearchQuery(value);
  return q.length > 0 && /[\u3400-\u9fff]/u.test(q);
}

// EC /gearsets 的检索由站点 GET 参数 search 驱动。Vue/动态过滤器不保证在
// input 事件时同步读取被临时改写的值；因此只在明确提交时用站点原生 URL 查询。
// 仅识别 Gearsets 主搜索框，不接管筛选部位、职业或其他页面的输入框。
function isECGearsetsSearchInput(input) {
  if (!isECGearsetsPage() || String(input?.tagName || '').toUpperCase() !== 'INPUT'
      || input.disabled || input.readOnly) return false;
  if (/vs__search/.test(String(input.className || ''))) return false;
  const meta = [input.getAttribute?.('name'), input.getAttribute?.('id'),
    input.getAttribute?.('placeholder'), input.getAttribute?.('aria-label')]
    .filter(Boolean).join(' ');
  if (/search by (title|player)|author|username|creator|filter by|作者|玩家|标题|標題/i.test(meta)) return false;
  // translateECAttrs 会将 "Search..." 翻译为 "搜索…"，识别不能只依赖英文占位符。
  return /\b(search|keyword)\b/i.test(meta) || /搜索|搜尋|检索|檢索/.test(meta);
}

function ecGearsetsSearchUrl(native, href) {
  if (!native) return null;
  try {
    const url = new URL(href);
    url.searchParams.set('search', native);
    url.searchParams.delete('page'); // 换关键词后必须回到第一页，否则会误报无结果。
    return url.toString();
  } catch { return null; }
}

function submitECGearsetsSearch(input, selectedNative = null) {
  if (!isECGearsetsSearchInput(input)) return false;
  const query = normalizeSearchQuery(input.value);
  if (!isChineseSearchQuery(query)) return false;
  const native = selectedNative || resolveECGearsetSearch(query);
  if (!native) return false; // 多个不相关套装不猜测英文词，继续由候选明确选择。
  const url = ecGearsetsSearchUrl(native, globalThis.location?.href);
  if (!url || typeof globalThis.location?.assign !== 'function') return false;
  globalThis.location.assign(url);
  return true;
}

function searchInputScore(input) {
  if (!input) return -Infinity;
  const type = String(input.getAttribute?.('type') || '').toLowerCase();
  if (!SEARCH_INPUT_TYPES.has(type) || input.disabled || input.readOnly) return -Infinity;
  // 1.4.2 后续修复：vue-select 搜索框（EC 部位筛选器）不是表单搜索框——
  // 其值不参与表单序列化，输入即触发站点检索；完全排除，交给独立搜索框路径处理。
  if (/vs__search/.test(String(input.className || ''))) return -Infinity;
  const meta = [
    input.getAttribute?.('name'),
    input.getAttribute?.('id'),
    input.getAttribute?.('placeholder'),
    input.getAttribute?.('aria-label'),
    input.getAttribute?.('title'),
  ].filter(Boolean).join(' ');
  if (SEARCH_EXCLUDE_RE.test(meta)) return -Infinity; // 已排除字段不能进入兜底搜索框候选。
  let score = 0;
  if (/装備名(?:の一部)?を入力して検索|装備名.*検索|検索.*装備名/u.test(meta)) score += 120;
  if (/keyword/i.test(meta)) score += 100;
  if (/search/i.test(meta)) score += 80;
  // EC 主搜索框在正式汉化后占位符变成「搜索」，name/id 均可能为空。
  // 提交表单时必须为该输入框赋予与英文 Search 相同的识别优先级。
  if (/搜索|搜尋|检索|檢索/u.test(meta)) score += 80;
  if (/query|(^|[-_])q([-_]|$)/i.test(meta)) score += 70;
  if (/关键词|关键字|キーワード|検索|装備品|装備|검색|장비|키워드/u.test(meta)) score += 70;
  if (input.getAttribute?.('placeholder')) score += 5;
  return score;
}

function findSearchInput(form) {
  if (!form?.querySelectorAll) return null;
  const cached = _searchInputCache.get(form);
  if (cached && cached.isConnected !== false
      && (!form.contains || form.contains(cached))) {
    return cached;
  }

  const candidates = [...form.querySelectorAll('input')];
  let best = null;
  let bestScore = -Infinity;
  for (const input of candidates) {
    const score = searchInputScore(input);
    if (score > bestScore) {
      best = input;
      bestScore = score;
    }
  }

  let result = null;
  if (bestScore >= 5) result = best;
  else {
    const usable = candidates.filter((input) => searchInputScore(input) > -Infinity);
    result = usable.length === 1 ? usable[0] : null;
  }
  if (result) _searchInputCache.set(form, result);
  return result;
}

function buildSearchUrl(action, entries, inputName, native, baseHref) {
  if (!inputName || !native) return null;
  let url;
  try {
    url = new URL(action || baseHref, baseHref);
  } catch {
    return null;
  }

  const grouped = new Map();
  for (const [key, value] of entries || []) {
    // 1.4.2 后续修复：空值参数不得进入搜索 URL —— mirapri 实测（2026-10-07）：
    // 空筛选参数（cl/j/r/t/c/fav 等）会被站方当作「生效的无效筛选」→ 搜索恒为 0 结果；
    // 剔除空值后 ?keyword=X 正常返回（25 条/页），有效筛选（如 j=15）保留后亦正常。
    if (!key || typeof value !== 'string' || value === '') continue;
    const values = grouped.get(key) || [];
    values.push(value);
    grouped.set(key, values);
  }

  for (const key of grouped.keys()) url.searchParams.delete(key);
  for (const [key, values] of grouped) {
    for (const value of values) url.searchParams.append(key, value);
  }
  url.searchParams.delete(inputName);
  url.searchParams.set(inputName, native);
  return url.toString();
}

function formEntries(form) {
  try {
    const fd = new FormData(form);
    return [...fd.entries()];
  } catch {
    return null;
  }
}

function rewriteInputTemporarily(input, native) {
  const previous = input.value;
  input.value = native;
  setTimeout(() => {
    if (!input.isConnected) return;
    if (input.value === native) input.value = previous;
  }, 0);
}


const SUGGEST_MIN_CHARS = 2;
// 候选列表可视行数：数据全量渲染（显示所有含输入字的装备），
// 列表高度限 8 行，超出的通过滚轮在列表内滑动翻看。
const SUGGEST_VISIBLE_ROWS = 8;
const SUGGEST_ROW_HEIGHT = 44;   // 触摸目标不少于 44px，与 CSS 对齐
const SUGGEST_RENDER_BATCH = 80;  // 首批至多 80 行，滚动接近底部时渐进追加
const SUGGEST_DEBOUNCE_MS = 70;
const SUGGEST_HIDE_DELAY_MS = 120;

let _suggestBox = null;
let _suggestInput = null;
let _suggestRows = [];
let _suggestRendered = 0;
let _suggestActive = -1;
let _suggestTimer = null;
let _suggestHideTimer = null;
let _suggestStyleReady = false;
let _suggestDataReady = false;
const _composingInputs = new WeakSet();
const _convertedInputs = new WeakMap();
const _programmaticInputs = new WeakSet();
const _selectedSearchRows = new WeakMap();

// EC vue-select first filters remote results; only its native option click
// commits the selected equipment into Vue's component model.
const EC_NATIVE_PICK_TIMEOUT_MS = 4000;
let _ecPendingNativePick = null;

function cancelECNativePick() {
  const pending = _ecPendingNativePick;
  if (!pending) return;
  _ecPendingNativePick = null;
  pending.observer?.disconnect();
  clearTimeout(pending.timer);
}

// The EC localization walker may replace the label. Prefer the preserved
// original equipment name; compare translated text only as a unique fallback.
function ecNativeOptionMatch(option, row) {
  const clean = text => String(text || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const source = option.getAttribute?.('data-zhixia-source-text');
  if (source) return clean(source) === clean(row.native) ? 'native' : null;
  if (clean(option.textContent) === clean(row.native)) return 'native';
  return clean(option.textContent) === clean(row.zh) ? 'zh' : null;
}

function ecNativePickCandidates(pending) {
  return [...pending.root.querySelectorAll('.vs__dropdown-option')].filter(option =>
    option.isConnected !== false
    && option.getAttribute?.('aria-disabled') !== 'true'
    && !option.classList?.contains('vs__dropdown-option--disabled'));
}

function ecNativePickTarget(pending) {
  const options = ecNativePickCandidates(pending);
  const originals = options.filter(option => ecNativeOptionMatch(option, pending.row) === 'native');
  const matches = originals.length ? originals : options.filter(option =>
    ecNativeOptionMatch(option, pending.row) === 'zh');
  return matches.length === 1 ? matches[0] : null;
}

function attemptECNativePick(pending) {
  if (_ecPendingNativePick !== pending) return;
  // An input edit or replaced component invalidates any pending XHR result.
  if (pending.input.isConnected === false || pending.input.value !== pending.row.native) {
    cancelECNativePick();
    return;
  }
  const target = ecNativePickTarget(pending);
  if (!target) return;
  cancelECNativePick();
  // vue-select selects the LI on click; mousedown on the UL only preserves
  // focus. Use its own component handler so v-model and selected chips update.
  target.click?.();
}

function armECNativePick(input, row) {
  cancelECNativePick();
  const root = input.closest?.('.v-select');
  if (!root?.querySelectorAll) return null;
  const pending = { input, root, row, observer: null, timer: null };
  _ecPendingNativePick = pending;
  const attempt = () => attemptECNativePick(pending);
  pending.timer = setTimeout(() => {
    if (_ecPendingNativePick === pending) cancelECNativePick();
  }, EC_NATIVE_PICK_TIMEOUT_MS);
  if (typeof MutationObserver === 'function') {
    pending.observer = new MutationObserver(attempt);
    pending.observer.observe(root, { childList: true, subtree: true, characterData: true });
  }
  return attempt;
}

function isSearchInput(input) {
  const form = input?.form;
  if (!form) return false;
  const cached = _searchInputCache.get(form);
  if (cached && cached !== input) _searchInputCache.delete(form);
  return findSearchInput(form) === input;
}

// 1.4.2 后续修复（b 方案）：可挂候选面板的输入框 = 表单搜索框 + 独立搜索框
// （ronka / collection 无 form 站，以及 EC vue-select 部位筛选器）。
// 输入停顿一律不自动转换；仅候选面板点选（转换式搜索）与表单提交（临时替换）时转换。
function isSuggestibleInput(input) {
  if (isSearchInput(input)) return true;
  return isStandaloneSearchInput(input);
}

function isSuggestionQuery(value) {
  const query = normalizeSearchQuery(value);
  return query.length >= SUGGEST_MIN_CHARS && /[\u3400-\u9fff]/u.test(query);
}

function ensureSuggestionStyle() {
  if (_suggestStyleReady || typeof document === 'undefined') return;
  const host = document.head || document.documentElement;
  if (!host?.appendChild || !document.createElement) return;
  const style = document.createElement('style');
  style.textContent = [
    '[data-zhx-chinese-suggest]{position:fixed;display:block;box-sizing:border-box;overflow:auto;margin:0;padding:4px;background:#fff;border:1px solid rgba(0,0,0,.16);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:2147483647;font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '[data-zhx-chinese-suggest][hidden]{display:none;}',
    '[data-zhx-chinese-suggest] button{display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;width:100%;min-height:44px;margin:0;padding:10px 10px;border:0;border-radius:6px;background:transparent;color:#222;text-align:left;cursor:pointer;}',
    '[data-zhx-chinese-suggest] button:hover,[data-zhx-chinese-suggest] button[data-active="1"]{background:#f0f2f5;}',
    '[data-zhx-chinese-suggest] .zhx-suggest-zh{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '[data-zhx-chinese-suggest] .zhx-suggest-native{margin-left:12px;overflow:hidden;color:#777;font-size:12px;text-overflow:ellipsis;white-space:nowrap;}',
    '[data-zhx-chinese-suggest] .zhx-suggest-empty{box-sizing:border-box;min-height:40px;padding:10px;color:#777;text-align:center;}',
  ].join('');
  host.appendChild(style);
  _suggestStyleReady = true;
}

function positionSuggestionBox(input) {
  if (!_suggestBox || _suggestBox.hidden || !input?.getBoundingClientRect) return;
  const rect = input.getBoundingClientRect();
  const gap = 4;
  const margin = 8;
  // 手机软键盘会缩小 visualViewport，但不一定同步更新 innerHeight。
  const view = globalThis.visualViewport;
  const viewportWidth = Number(view?.width) || Number(globalThis.innerWidth) || document.documentElement?.clientWidth || 0;
  const viewportHeight = Number(view?.height) || Number(globalThis.innerHeight) || document.documentElement?.clientHeight || 0;
  const viewLeft = Number(view?.offsetLeft) || 0;
  const viewTop = Number(view?.offsetTop) || 0;
  const roomWidth = Math.max(0, viewportWidth - margin * 2);
  const width = Math.min(Math.max(rect.width, 180), roomWidth);
  const left = Math.min(Math.max(viewLeft + margin, rect.left), viewLeft + Math.max(margin, viewportWidth - width - margin));
  const belowSpace = Math.max(0, viewTop + viewportHeight - rect.bottom - gap - margin);
  const aboveSpace = Math.max(0, rect.top - viewTop - gap - margin);
  const openBelow = belowSpace >= SUGGEST_ROW_HEIGHT * 2 || belowSpace >= aboveSpace;
  const available = openBelow ? belowSpace : aboveSpace;
  const rowsHeight = SUGGEST_VISIBLE_ROWS * SUGGEST_ROW_HEIGHT + 8;
  const maxHeight = Math.max(0, Math.min(rowsHeight, available));
  const top = openBelow ? rect.bottom + gap : Math.max(viewTop + margin, rect.top - gap - maxHeight);
  _suggestBox.style.left = left + 'px';
  _suggestBox.style.top = top + 'px';
  _suggestBox.style.width = width + 'px';
  _suggestBox.style.maxHeight = maxHeight + 'px';
}

// 滚动/缩放时保持候选框（1.4.2 后续修复）：输入框仍在视口内 → 跟随重定位（保持打开）；
// 已滚出视口 → 关闭。滚动本身不再直接关闭候选框（无滚动条的候选框、滚到列表边界后
// 继续滚动会链式带动页面滚动——这些场景都不应让候选框消失）。
function syncSuggestionsOnScroll() {
  if (!_suggestBox || _suggestBox.hidden) return;
  const input = _suggestInput;
  if (!input || input.isConnected === false) {
    hideSuggestions(true);
    return;
  }
  const rect = input.getBoundingClientRect?.();
  if (!rect) {
    hideSuggestions(true);
    return;
  }
  const view = globalThis.visualViewport;
  const width = Number(view?.width) || Number(globalThis.innerWidth) || document.documentElement?.clientWidth || 0;
  const height = Number(view?.height) || Number(globalThis.innerHeight) || document.documentElement?.clientHeight || 0;
  const left = Number(view?.offsetLeft) || 0;
  const top = Number(view?.offsetTop) || 0;
  const onScreen = rect.bottom > top && rect.top < top + height && rect.right > left && rect.left < left + width;
  if (!onScreen) {
    hideSuggestions(true);
    return;
  }
  positionSuggestionBox(input);
}

function hideSuggestions(clearInputState = false) {
  if (_suggestTimer) {
    clearTimeout(_suggestTimer);
    _suggestTimer = null;
  }
  if (_suggestHideTimer) {
    clearTimeout(_suggestHideTimer);
    _suggestHideTimer = null;
  }
  if (_suggestBox) _suggestBox.hidden = true;
  if (_suggestInput) {
    _suggestInput.setAttribute('aria-expanded', 'false');
    if (clearInputState) _suggestInput.removeAttribute('aria-activedescendant');
  }
  _suggestRows = [];
  _suggestRendered = 0;
  _suggestActive = -1;
}

// Explicit dismissal prevents a pending V3 ready callback reopening stale UI.
function dismissSuggestions() {
  hideSuggestions(true);
  _suggestInput = null;
}

function scheduleSuggestions(input) {
  if (_suggestTimer) clearTimeout(_suggestTimer);
  _suggestTimer = setTimeout(() => {
    _suggestTimer = null;
    showSuggestions(input);
  }, SUGGEST_DEBOUNCE_MS);
}

function isECVueSearchInput(input) {
  return _activeSearchSiteId === 'ec'
    && /\bvs__search\b/.test(String(input?.className || ''));
}

function selectSuggestion(index) {
  const row = _suggestRows[index];
  if (!row || !_suggestInput) return;
  const input = _suggestInput;
  input.focus({ preventScroll: true });
  // EC's vue-select owns the input's value. Never write a temporary Chinese
  // label into this controlled field; it can race the component's own v-model
  // updates and make subsequent typing appear to be ignored/reset.
  if (!isECVueSearchInput(input)) input.value = row.zh;
  _selectedSearchRows.set(input, row);
  dismissSuggestions();
  try {
    input.setSelectionRange(input.value.length, input.value.length);
  } catch {
    /* 输入类型变化时忽略光标定位失败 */
  }
  // 独立搜索框（React 站点，b 方案）：选中候选后做「转换式搜索」——
  // 用原生名触发站内检索，随后输入框显示恢复为中文。
  // 两类控件遵循相同选择语义：选择候选就执行一次站内搜索。
  // EC Gearsets 候选点击必须使用原站 GET 检索，不能仅派发 input 事件；
  // 站点的动态组件可能在事件后重新写入中文，导致结果恒为空。
  if (submitECGearsetsSearch(input, row.native)) return;
  // EC vue-select needs an actual native-option selection, not merely an
  // input event that leaves the dropdown waiting for a second click.
  if (isECVueSearchInput(input)) {
    const attempt = armECNativePick(input, row);
    if (!convertStandaloneForSearch(input, false, row.native)) cancelECNativePick();
    else attempt?.();
    return;
  }
  // 原站表单必须经过 requestSubmit（触发现有校验及捕获监听），不能调用 form.submit()。
  if (isStandaloneSearchInput(input)) convertStandaloneForSearch(input, false, row.native);
  else if (isSearchInput(input) && typeof input.form?.requestSubmit === 'function') {
    input.form.requestSubmit();
  }
}

// 保留完整候选数组，但只渲染小批量 DOM；触底和键盘导航时按需追加。
function appendSuggestionBatch() {
  if (!_suggestBox || !_suggestRows.length) return;
  const end = Math.min(_suggestRows.length, _suggestRendered + SUGGEST_RENDER_BATCH);
  for (let index = _suggestRendered; index < end; index++) {
    const row = _suggestRows[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'zhx-chinese-suggest-' + index;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', 'false');
    button.dataset.zhxIndex = String(index);
    const zh = document.createElement('span');
    zh.className = 'zhx-suggest-zh';
    zh.textContent = row.zh;
    const native = document.createElement('span');
    native.className = 'zhx-suggest-native';
    let statusSuffix = '';
    if (row.provisional) statusSuffix = ' · EC 结果待确认';
    else if (row.descriptive) statusSuffix = ' · 描述性译名';
    native.textContent = row.native + statusSuffix;
    button.append(zh, native);
    _suggestBox.appendChild(button);
  }
  _suggestRendered = end;
}

function updateSuggestionActive(index) {
  if (!_suggestBox) return;
  _suggestActive = index;
  while (index >= _suggestRendered && _suggestRendered < _suggestRows.length) appendSuggestionBatch();
  const buttons = _suggestBox.querySelectorAll('button[data-zhx-index]');
  for (const button of buttons) {
    const active = Number(button.dataset.zhxIndex) === index;
    button.dataset.active = active ? '1' : '0';
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  const activeButton = buttons[index];
  if (activeButton) {
    activeButton.scrollIntoView({ block: 'nearest' });
    if (activeButton.id) _suggestInput?.setAttribute('aria-activedescendant', activeButton.id);
  } else {
    _suggestInput?.removeAttribute('aria-activedescendant');
  }
}

function showSuggestions(input) {
  if (!isSuggestibleInput(input) || !input.isConnected) {
    hideSuggestions(true);
    return;
  }
  const query = normalizeSearchQuery(input.value);
  // 在数据尚未就绪时也要记住当前输入框，数据 ready 回调才能补显示候选。
  _suggestInput = input;
  if (!isSuggestionQuery(query)) {
    hideSuggestions(true);
    return;
  }
  // Gearsets 候选只依赖已加载的本地套装目录/词典，不必等待 V3 物品表；
  // 否则 V3 网络超时会让整个套装检索也无法使用。
  // Facewear's dedicated, bundled Glasses sheet works even without remote V3.
  // Bardings / equipment slots still require the classified V3 item index.
  if (!_suggestDataReady && !isECGearsetsPage() && ecSearchContext(input)?.kind !== 'facewear') {
    hideSuggestions(true);
    return;
  }

  const rows = ecScopedSuggestions(query, input);

  ensureSuggestionStyle();
  if (!_suggestBox) {
    _suggestBox = document.createElement('div');
    _suggestBox.id = 'zhx-chinese-suggest-list';
    _suggestBox.dataset.zhxChineseSuggest = '';
    _suggestBox.setAttribute('role', 'listbox');
    (document.body || document.documentElement)?.appendChild(_suggestBox);
  }
  if (!_suggestBox) return;

  _suggestInput = input;
  _suggestRows = rows;
  _suggestRendered = 0;
  _suggestActive = -1;
  _suggestBox.replaceChildren();

  if (!rows.length) {
    const message = document.createElement('div');
    message.className = 'zhx-suggest-empty';
    message.textContent = isECGearsetsPage() ? '未找到对应套装' : '未找到对应装备';
    message.setAttribute('role', 'status');
    _suggestBox.setAttribute('role', 'status');
    _suggestBox.appendChild(message);
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', _suggestBox.id);
    _suggestBox.hidden = false;
    positionSuggestionBox(input);
    return;
  }

  _suggestBox.setAttribute('role', 'listbox');
  appendSuggestionBatch();

  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', _suggestBox.id);
  _suggestBox.hidden = false;
  positionSuggestionBox(input);
}

function handleSearchInput(event) {
  const input = event.target;
  // Programmatic native-name input is part of the pending EC selection;
  // a real subsequent keystroke cancels it before a late XHR response.
  if (_ecPendingNativePick?.input === input && !_programmaticInputs.has(input)) {
    cancelECNativePick();
  }
  if (!_programmaticInputs.has(input)) {
    _convertedInputs.delete(input);
    _selectedSearchRows.delete(input);
  }
  if (isSearchInput(input)) {
    if (_composingInputs.has(input)) return;
    scheduleSuggestions(input);
    return;
  }
  // 独立搜索框（无 form）：由 handleStandaloneSearchInput 调度（候选 + 自动转换），此处不清候选。
  if (isStandaloneSearchInput(input)) return;
  if (_suggestInput === input) hideSuggestions(true);
}

function handleSearchFocus(event) {
  const input = event.target;
  if (_ecPendingNativePick && _ecPendingNativePick.input !== input) cancelECNativePick();
  if (!isSuggestibleInput(input) || _composingInputs.has(input)) return;
  scheduleSuggestions(input);
}

function handleSearchBlur(event) {
  if (_suggestInput !== event.target) return;
  if (_suggestHideTimer) clearTimeout(_suggestHideTimer);
  const blurred = event.target;
  _suggestHideTimer = setTimeout(() => {
    _suggestHideTimer = null;
    // 1.4.2 后续修复：延迟内焦点可能已移到另一个搜索框（表单框 ↔ 独立框切换），
    // 仅当 _suggestInput 仍是被失焦的框时才隐藏，避免误藏新框的候选面板。
    if (_suggestInput === blurred) dismissSuggestions();
  }, SUGGEST_HIDE_DELAY_MS);
}

function handleSuggestionKeydown(event) {
  // EC vue-select already implements its own keyboard list navigation.
  // Hijacking Up/Down/Escape/Enter in document capture breaks that native
  // dropdown; our Chinese suggestions remain pointer-selectable.
  if (isECVueSearchInput(event.target)) return false;
  if (_suggestInput !== event.target || !_suggestBox || _suggestBox.hidden || !_suggestRows.length) return false;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    updateSuggestionActive((_suggestActive + 1) % _suggestRows.length);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    updateSuggestionActive((_suggestActive + _suggestRows.length - 1) % _suggestRows.length);
  } else if (event.key === 'Escape') {
    // Do not swallow native Escape handling.
    dismissSuggestions();
  } else if (event.key === 'Enter' && _suggestActive >= 0) {
    event.preventDefault();
    event.stopPropagation();
    selectSuggestion(_suggestActive);
  } else return false;
  return true;
}

function handleSearchKeydown(event) {
  const input = event.target;
  if (event.isComposing || _composingInputs.has(input) || event.keyCode === 229) return;
  if (handleSuggestionKeydown(event)) return;
  // Gearsets 的 search GET 参数是网站的查询入口；按回车时立即导航，
  // 而不是向可能有异步状态的前端组件派发临时原生名 input。
  if (event.key === 'Enter' && submitECGearsetsSearch(input)) {
    event.preventDefault();
    event.stopPropagation();
    hideSuggestions(true);
    return;
  }
  // 其他站点显式搜索保留原站回车事件。
  if (event.key === 'Enter' && isStandaloneSearchInput(input) && convertStandaloneForSearch(input, true)) hideSuggestions(true);
}

// Only the custom option is intercepted; clicks elsewhere dismiss our UI
// without canceling any site-native pointer handlers (including EC vue-select).
function handleSuggestionPointerDown(event) {
  const target = event.target;
  if (_ecPendingNativePick && target
      && !_ecPendingNativePick.root.contains(target)) cancelECNativePick();
  if (!target || !_suggestInput) return;
  if (_suggestBox?.contains(target)) {
    const button = target.closest?.('button[data-zhx-index]');
    if (!button || !_suggestBox.contains(button)) return;
    event.preventDefault();
    selectSuggestion(Number(button.dataset.zhxIndex));
    return;
  }
  if (target === _suggestInput || _suggestInput.contains?.(target)) return;
  // Also cancel pending candidates before the V3 item table is ready.
  dismissSuggestions();
}

function handleCompositionStart(event) {
  const input = event.target;
  if (isSuggestibleInput(input)) {
    _composingInputs.add(input);
    if (_suggestInput === input) hideSuggestions(true);
  }
}

function handleCompositionEnd(event) {
  const input = event.target;
  if (!isSuggestibleInput(input)) return;
  _composingInputs.delete(input);
  scheduleSuggestions(input);
}

// ── 独立搜索框（1.4.2 后续修复；b 方案）──
// ronka 等站点的搜索框不属于任何 form（React 客户端过滤、无提交事件可拦）；
// b 方案：打字期间不做任何自动转换；候选面板点选后做「转换式搜索」
//（用原生名触发站内检索，随后输入框显示恢复为中文，见 convertStandaloneForSearch）。
const STANDALONE_SEARCH_HINT_RE = /검색어|키워드|キーワード|搜索|搜尋|検索|search|关键词|關鍵詞|keyword/i;
const STANDALONE_EXCLUDE_TYPES = new Set(['hidden', 'password', 'email', 'tel', 'url', 'number', 'date', 'datetime-local', 'month', 'week', 'time', 'color', 'range', 'file', 'checkbox', 'radio', 'button', 'submit', 'reset', 'image']);

function isStandaloneSearchInput(input) {
  if (!input) return false;
  if (String(input.tagName || '').toUpperCase() !== 'INPUT') return false;
  const type = String(input.getAttribute?.('type') || '').toLowerCase();
  if (STANDALONE_EXCLUDE_TYPES.has(type)) return false;
  if (input.disabled || input.readOnly) return false;
  // 1.4.2 后续修复：vue-select 搜索输入框（EC 部位筛选器，如 "Any head"）——
  // 不依赖 form 归属：输入即触发站点装备检索（EC 实测 POST /gear/<slot>/search）；
  // b 方案后与独立搜索框统一：打字不转换，候选面板点选时做「转换式搜索」。
  if (/vs__search/.test(String(input.className || ''))) {
    return SEARCH_SITES[_activeSearchSiteId]?.vueSelect === true;
  }
  if (input.form) return false;
  const meta = [
    input.getAttribute?.('placeholder'),
    input.getAttribute?.('aria-label'),
    input.getAttribute?.('name'),
    input.getAttribute?.('id'),
    input.getAttribute?.('title'),
  ].filter(Boolean).join(' ');
  const field = [input.getAttribute?.('name'), input.getAttribute?.('id')].filter(Boolean).join(' ');
  if (SEARCH_EXCLUDE_RE.test(field) || /search by title|作者|用户名|评论|タイトル|プレイヤー|작성자/i.test(meta)) return false;
  return STANDALONE_SEARCH_HINT_RE.test(meta);
}

function rewriteInputNatively(input, native) {
  let applied = false;
  try {
    const descriptor = typeof HTMLInputElement !== 'undefined' && HTMLInputElement.prototype
      ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      : null;
    if (descriptor?.set) {
      descriptor.set.call(input, native);
      applied = input.value === native;
    }
  } catch { /* 回退：直接赋值 */ }
  if (!applied) {
    try {
      input.value = native;
      applied = input.value === native;
    } catch { /* 忽略 */ }
  }
  if (!applied) return false;
  _programmaticInputs.add(input);
  try {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } catch { /* 事件派发失败不影响替换结果 */ }
  finally { _programmaticInputs.delete(input); }
  return true;
}

// b 方案（2026-10-08）：点选候选后的「转换式搜索」——用原生名触发站点检索（派发 input），
// 随后把输入框显示恢复为中文（静默设值，不再派发事件；若站点已改写则不动）。
function convertStandaloneForSearch(input, allowPartial = false, selectedNative = null) {
  try {
    if (!input || input.isConnected === false || _composingInputs.has(input)) return false;
    const shown = input.value;
    const query = normalizeSearchQuery(shown);
    if (query.length < 2 || !isChineseSearchQuery(query)) return false;
    const context = ecSearchContext(input);
    const native = selectedNative
      || (context ? ecScopedNative(query, input, allowPartial) : null)
      || (!context && isECGearsetsPage() ? resolveECGearsetSearch(query) : null)
      || (!context ? resolveByZh(query) : null)
      || (!context && allowPartial ? resolvePartialByZh(query) : null);
    if (!native || native === query) return false;
    if (!rewriteInputNatively(input, native)) return false;
    // The EC vue-select model must remain synchronized with the dispatched
    // native search term. Silent delayed display restoration desynchronizes
    // its DOM value from Vue state and can override later user keystrokes.
    if (!isECVueSearchInput(input)) restoreStandaloneDisplay(input, shown, native);
    return true;
  } catch { return false; /* 转换失败时保留站点原有搜索行为 */ }
}

function restoreStandaloneDisplay(input, shown, native) {
  const token = {};
  _convertedInputs.set(input, token);
  // React 结果加载期间可能再次回写受控值；有限次恢复显示，用户继续输入即取消。
  for (const delay of [0, 100, 500, 1500, 3000]) {
    setTimeout(() => {
      if (_convertedInputs.get(input) !== token || input.isConnected === false) return;
      if (input.value === native) setInputValueSilently(input, shown);
      if (delay === 3000) _convertedInputs.delete(input);
    }, delay);
  }
}

// 从搜索按钮所在的最小容器查找独立搜索框，避免影响其他字段或候选按钮。
function findStandaloneTriggerInput(button) {
  let root = button.parentElement || button.parentNode;
  for (let depth = 0; root && depth < 8; depth++, root = root.parentElement || root.parentNode) {
    if (root === document.body || root === document.documentElement) return null;
    const inputs = [...(root.querySelectorAll?.('input') || [])].filter(isStandaloneSearchInput);
    if (_suggestInput && inputs.includes(_suggestInput)) return _suggestInput;
    if (inputs.length === 1) return inputs[0];
    if (inputs.length > 1 || root === document.body) return null;
  }
  return null;
}

function handleStandaloneSearchClick(event) {
  const button = event.target?.closest?.('button, input[type="submit"], [role="button"]');
  if (!button || button.disabled || _suggestBox?.contains(button)) return;
  const label = [button.textContent, button.getAttribute?.('title'), button.getAttribute?.('aria-label'), button.value]
    .filter(Boolean).join(' ').trim();
  if (/clear|reset|取消|重置|清空|初期化|초기화|지우기/i.test(label)) return;
  if (!/搜索|搜尋|查询|查找|검색|検索|\bsearch\b|필터\s*적용|应用筛选|適用|\bapply\b/i.test(label)) return;
  const input = findStandaloneTriggerInput(button);
  if (input && submitECGearsetsSearch(input)) {
    event.preventDefault();
    event.stopPropagation();
    hideSuggestions(true);
    return;
  }
  if (input && convertStandaloneForSearch(input, true)) hideSuggestions(true);
}

// 静默设值：更新输入框显示，但不派发 input 事件（避免二次触发站点检索）。
function setInputValueSilently(input, value) {
  try {
    const descriptor = typeof HTMLInputElement !== 'undefined' && HTMLInputElement.prototype
      ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      : null;
    if (descriptor?.set) {
      descriptor.set.call(input, value);
      if (input.value === value) return true;
    }
  } catch { /* 回退：直接赋值 */ }
  try {
    input.value = value;
    return input.value === value;
  } catch {
    return false;
  }
}

function handleStandaloneSearchInput(event) {
  const input = event.target;
  if (isSearchInput(input)) return;
  if (isStandaloneSearchInput(input)) {
    // b 方案（2026-10-08）：输入停顿不自动转换（禁止输入即搜索）；仅候选面板点选时转换。
    // 1.4.2 后续修复：独立搜索框也显示智能候选面板（ronka / collection / EC vue-select）。
    if (isSuggestibleInput(input)) scheduleSuggestions(input);
  }
}

function bindChineseSearchUi() {
  document.addEventListener('input', handleSearchInput, true);
  document.addEventListener('input', handleStandaloneSearchInput, true);
  document.addEventListener('focusin', handleSearchFocus, true);
  document.addEventListener('focusout', handleSearchBlur, true);
  document.addEventListener('keydown', handleSearchKeydown, true);
  document.addEventListener('compositionstart', handleCompositionStart, true);
  document.addEventListener('compositionend', handleCompositionEnd, true);
  document.addEventListener('pointerdown', handleSuggestionPointerDown, true);
  document.addEventListener('click', handleStandaloneSearchClick, true);
  document.addEventListener('scroll', (event) => {
    // 列表自身滚动（滚轮翻看全部装备）无需处理；页面滚动只做同步——
    // 输入框仍在视口内则保持打开并跟随重定位，已滚出视口才关闭。
    if (_suggestBox && event.target && _suggestBox.contains(event.target)) {
      if (event.target === _suggestBox && !_suggestBox.hidden
          && _suggestBox.scrollTop + _suggestBox.clientHeight >= _suggestBox.scrollHeight - SUGGEST_ROW_HEIGHT * 2) {
        appendSuggestionBatch();
      }
      return;
    }
    syncSuggestionsOnScroll();
  }, true);
  globalThis.addEventListener?.('resize', () => syncSuggestionsOnScroll());
  globalThis.visualViewport?.addEventListener?.('resize', () => syncSuggestionsOnScroll());
  globalThis.visualViewport?.addEventListener?.('scroll', () => syncSuggestionsOnScroll());
}

// EC Gearsets 原生路由提交单独处理，避免与其它站点的 GET/POST 表单分支
// 交叉嵌套；成功时消费事件，失败时由既有站点提交链处理。
function handleECGearsetsFormSubmit(event, siteId, input, query, selected) {
  if (siteId !== 'ec') return false;
  const native = selected?.zh === query ? selected.native : null;
  if (!submitECGearsetsSearch(input, native)) return false;
  _selectedSearchRows.delete(input);
  event.preventDefault();
  event.stopPropagation();
  hideSuggestions(true);
  return true;
}

function nativeForSubmittedSearch(query, siteId, input, selected) {
  if (selected?.zh === query && selected.native) return selected.native;
  if (siteId === 'ec' && ecSearchContext(input)) return ecScopedNative(query, input, true);
  return resolveSearchNative(query, siteId === 'ec' && isECGearsetsPage());
}

function handleChineseSearchSubmit(event, siteId) {
  if (!SEARCH_SITES[siteId]) return;
  const form = event.target;
  _searchInputCache.delete(form);
  const input = findSearchInput(form);
  if (!input) return;

  const query = normalizeSearchQuery(input.value);
  if (!isChineseSearchQuery(query)) return;

  const selected = _selectedSearchRows.get(input);
  if (handleECGearsetsFormSubmit(event, siteId, input, query, selected)) return;
  const native = nativeForSubmittedSearch(query, siteId, input, selected);
  _selectedSearchRows.delete(input);
  // 套装页优先系列/职能片段映射；其余站点仍以物品总表 + 公共子串兜底。
  if (!native || native === query) return;

  const method = String(form.getAttribute?.('method') || 'get').toLowerCase();
  if (method === 'get' && input.name) {
    const entries = formEntries(form);
    const action = form.getAttribute?.('action') || globalThis.location?.href || '';
    const baseHref = globalThis.location?.href || action;
    const url = entries ? buildSearchUrl(action, entries, input.name, native, baseHref) : null;
    if (url) {
      event.preventDefault();
      event.stopPropagation();
      globalThis.location.assign(url);
      return;
    }
  }

  // 非 GET / 无 name 的搜索表单：只临时替换提交值，不改页面显示，不派发 input 事件。
  rewriteInputTemporarily(input, native);
}

function startChineseSearch(siteId) {
  if (!SEARCH_SITES[siteId]) return;
  _activeSearchSiteId = siteId;
  if (typeof document === 'undefined' || !document.addEventListener) return;
  if (globalThis.__zhxChineseSearchBound) return;
  globalThis.__zhxChineseSearchBound = true;
  bindChineseSearchUi();
  onTablesReady(() => {
    _suggestDataReady = true;
    if (_suggestInput?.isConnected && isSuggestionQuery(_suggestInput.value)) showSuggestions(_suggestInput);
  });
  document.addEventListener('submit', (event) => {
    try {
      handleChineseSearchSubmit(event, siteId);
    } catch (error) {
      console.warn('[zhx] 中文装备搜索失败', error);
    }
  }, true);
}

export {
  SEARCH_SITES,
  buildSearchUrl,
  findSearchInput,
  handleChineseSearchSubmit,
  isChineseSearchQuery,
  normalizeSearchQuery,
  isECGearsetsPage,
  resolveSearchNative,
  positionSuggestionBox,
  searchInputScore,
  startChineseSearch,
};
