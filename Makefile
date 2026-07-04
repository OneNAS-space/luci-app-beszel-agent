# SPDX-License-Identifier: GPL-2.0-only

include $(TOPDIR)/rules.mk

LUCI_NAME:=luci-app-beszel-agent
LUCI_MAINTAINER:=Jackie264 <OneNAS-space>
LUCI_TITLE:=LuCI support for Beszel Agent
LUCI_DEPENDS:=+luci-base beszel-agent
LUCI_PKGARCH:=all

PKG_LICENSE:=GPL-2.0-only
PKG_CPE_ID:=cpe:/a:Jackie264:luci-app-beszel-agent

PKG_UNPACK:=$(CURDIR)/.prepare.sh $(PKG_NAME) $(CURDIR) $(PKG_BUILD_DIR)

define Package/luci-app-beszel-agent/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || { 
    rm -f /tmp/luci-indexcache.*
    rm -rf /tmp/luci-modulecache/
    /etc/init.d/rpcd reload 2>/dev/null
}
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
