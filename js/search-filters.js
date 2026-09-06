// Search Filters Toggle Functionality
function toggleFilters() {
    const searchFilters = document.querySelector('.search-filters');
    const filterToggle = document.querySelector('.filter-toggle');
    
    if (searchFilters.classList.contains('expanded')) {
        searchFilters.classList.remove('expanded');
        filterToggle.classList.remove('active');
    } else {
        searchFilters.classList.add('expanded');
        filterToggle.classList.add('active');
    }
}

function toggleAdvancedFilters() {
    const searchFilters = document.querySelector('.search-filters');
    const advancedToggle = document.querySelector('.advanced-toggle');
    
    if (searchFilters.classList.contains('expanded')) {
        searchFilters.classList.remove('expanded');
        advancedToggle.classList.remove('active');
    } else {
        searchFilters.classList.add('expanded');
        advancedToggle.classList.add('active');
    }
}

// Initialize filter buttons
document.addEventListener('DOMContentLoaded', function() {
    // Add click handlers to filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
        });
    });
    
    // Close filters when clicking outside
    document.addEventListener('click', function(event) {
        const searchFilters = document.querySelector('.search-filters');
        const filterToggle = document.querySelector('.filter-toggle');
        const advancedToggle = document.querySelector('.advanced-toggle');
        
        if (searchFilters && !searchFilters.contains(event.target)) {
            searchFilters.classList.remove('expanded');
            if (filterToggle) filterToggle.classList.remove('active');
            if (advancedToggle) advancedToggle.classList.remove('active');
        }
    });
});
