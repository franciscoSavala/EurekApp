package com.eurekapp.backend.configuration;

import ch.qos.logback.classic.PatternLayout;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.CoreConstants;

public class CustomPatternLayout extends PatternLayout {
    @Override
    public String doLayout(ILoggingEvent event) {
        String originalMessage = super.doLayout(event);
        return originalMessage.replaceAll("\\r+|\\n+", "") + CoreConstants.LINE_SEPARATOR;
    }
}
