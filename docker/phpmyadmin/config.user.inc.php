<?php
/**
 * phpMyAdmin configuration file for Gelymar Platform
 * Custom configuration to increase upload limits
 */

// Increase upload limits
$cfg['UploadDir'] = '';
$cfg['SaveDir'] = '';

// Memory and execution time limits
$cfg['MemoryLimit'] = '512M';
$cfg['MaxExecutionTime'] = 300;

// File upload settings
$cfg['max_upload_size'] = '100M';
$cfg['max_input_vars'] = 10000;

// Session settings
$cfg['LoginCookieValidity'] = 1440;
$cfg['LoginCookieStore'] = 0;
$cfg['LoginCookieDeleteAll'] = true;

// Security settings
$cfg['AllowUserDropDatabase'] = false;
$cfg['Confirm'] = true;
$cfg['LoginCookieValidity'] = 1440;

// Display settings
$cfg['MaxRows'] = 100;
$cfg['Order'] = 'ASC';
$cfg['NavigationTreePointerEnable'] = true;
$cfg['FirstLevelNavigationItems'] = 100;
$cfg['MaxNavigationItems'] = 1000;

// Theme
$cfg['ThemeDefault'] = 'pmahomme';

// Server settings
$cfg['Servers'][$i]['auth_type'] = 'cookie';
$cfg['Servers'][$i]['host'] = 'mysql';
$cfg['Servers'][$i]['port'] = '3306';
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['AllowNoPassword'] = false;
$cfg['Servers'][$i]['AllowRoot'] = true;
?> 