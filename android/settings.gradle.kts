pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Chartboost SDK (AdMob mediation) is only published here
        maven { url = uri("https://cboost.jfrog.io/artifactory/chartboost-ads/") }
    }
}

rootProject.name = "KidsQuiz"
include(":app")
 