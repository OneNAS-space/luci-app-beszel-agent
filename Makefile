include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for Beszel Agent
LUCI_DEPENDS:=+beszel-agent
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-beszel-agent
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_MAINTAINER:=Jackie264 <OneNAS-space>
PKG_LICENSE:=MIT

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
